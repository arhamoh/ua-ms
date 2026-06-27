import { prisma } from '@/lib/prisma';
import { getSegment } from './icp';
import type { Segment } from './icp';
import { scoreLead } from './score';
import { MockSource } from './sources/mock';
import { ApolloSource } from './sources/apollo';
import type { LeadSource } from './sources/types';

/** True when a real Apollo key is configured (vs. falling back to mock data). */
export function hasApolloKey(): boolean {
  return !!process.env.APOLLO_API_KEY?.trim();
}

/** The active data source: Apollo if a key is set, otherwise the mock. */
export function getSource(): LeadSource {
  const key = process.env.APOLLO_API_KEY;
  return key?.trim() ? new ApolloSource(key) : new MockSource();
}

/** Source one segment's leads into the DB. */
export async function sourceSegment(
  segmentKey: string,
  limit: number,
  source: LeadSource = getSource(),
): Promise<{ created: number; skipped: number }> {
  const seg = getSegment(segmentKey);
  if (!seg) throw new Error(`Unknown segment "${segmentKey}".`);
  return sourceUsing(seg, limit, source);
}

/**
 * Source using an arbitrary filter set (a Segment object, which may be built on
 * the fly from a search form). Leads are tagged with `seg.key`.
 */
export async function sourceUsing(
  seg: Segment,
  limit: number,
  source: LeadSource = getSource(),
): Promise<{ created: number; skipped: number }> {
  const sourced = await source.search(seg, limit);
  let created = 0;
  let skipped = 0;

  for (const s of sourced) {
    if (s.externalId) {
      const exists = await prisma.lead.findUnique({ where: { externalId: s.externalId } });
      if (exists) {
        skipped++;
        continue;
      }
    }
    if (s.email) {
      const existsByEmail = await prisma.lead.findUnique({ where: { email: s.email } });
      if (existsByEmail) {
        skipped++;
        continue;
      }
    }

    let companyId: string | undefined;
    if (s.company?.name) {
      const company = await prisma.leadCompany.upsert({
        where: { domain: s.company.domain ?? `__no-domain-${s.company.name}` },
        update: {},
        create: {
          name: s.company.name,
          domain: s.company.domain,
          industry: s.company.industry,
          employeeCount: s.company.employeeCount,
          location: s.company.location,
          linkedinUrl: s.company.linkedinUrl,
        },
      });
      companyId = company.id;
    }

    const lead = await prisma.lead.create({
      data: {
        externalId: s.externalId,
        firstName: s.firstName,
        lastName: s.lastName,
        title: s.title,
        email: s.email,
        emailStatus: s.emailStatus ?? 'unknown',
        phone: s.phone,
        linkedinUrl: s.linkedinUrl,
        source: source.name,
        segment: seg.key,
        companyId,
        status: 'new',
      },
    });
    await prisma.leadActivity.create({ data: { leadId: lead.id, type: 'sourced', detail: `${source.name}/${seg.key}` } });
    created++;
  }

  return { created, skipped };
}

/** Score every lead against the segment it was sourced for. */
export async function scoreAll(): Promise<{ updated: number }> {
  const leads = await prisma.lead.findMany({ include: { company: true } });
  let updated = 0;
  for (const lead of leads) {
    const seg = lead.segment ? getSegment(lead.segment) : undefined;
    if (!seg) continue;
    const score = scoreLead(lead, seg);
    await prisma.lead.update({
      where: { id: lead.id },
      data: { score, status: lead.status === 'new' ? 'scored' : lead.status },
    });
    await prisma.leadActivity.create({ data: { leadId: lead.id, type: 'scored', detail: String(score) } });
    updated++;
  }
  return { updated };
}
