'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { segments, getSegment } from '@/lib/leadgen/icp';
import { sourceUsing, scoreAll, hasApolloKey } from '@/lib/leadgen/pipeline';
import { seedSequences, enrollSegment, runDue } from '@/lib/leadgen/outreach/engine';
import { convertLeadToClient } from '@/lib/leadgen/convert';

async function requireUser() {
  const user = await getSession();
  if (!user) throw new Error('Unauthorized');
  return user;
}

const TERMINAL = ['replied', 'won', 'lost', 'unqualified'];

export interface SearchInput {
  segment: string;
  titles: string[];
  industries: string[];
  locations: string[];
  employeeMin?: number;
  employeeMax?: number;
  limit?: number;
}

/** Live Apollo search with the given filters, then score + revalidate. */
export async function searchLeads(input: SearchInput) {
  await requireUser();
  if (!hasApolloKey()) {
    return { ok: false as const, error: 'APOLLO_API_KEY is not configured on the server.' };
  }
  const base = getSegment(input.segment) ?? segments[0];
  const seg = {
    ...base,
    targetTitles: input.titles.length ? input.titles : base.targetTitles,
    industries: Array.isArray(input.industries) ? input.industries : base.industries,
    locations: Array.isArray(input.locations) ? input.locations : base.locations,
    employeeRange: {
      min: Number.isFinite(input.employeeMin) ? Number(input.employeeMin) : base.employeeRange.min,
      max: Number.isFinite(input.employeeMax) ? Number(input.employeeMax) : base.employeeRange.max,
    },
  };
  const limit = Math.min(Math.max(Number(input.limit ?? 10), 1), 50);
  const { created, skipped } = await sourceUsing(seg, limit);
  await scoreAll();
  revalidatePath('/leads');
  return { ok: true as const, created, skipped, segment: base.key };
}

/** Update a lead's status; terminal states stop any active sequences. */
export async function setLeadStatus(leadId: string, status: string) {
  await requireUser();
  const allowed = ['new', 'scored', 'queued', 'contacted', 'replied', 'won', 'lost', 'unqualified'];
  if (!allowed.includes(status)) return { ok: false as const, error: 'bad status' };
  await prisma.lead.update({ where: { id: leadId }, data: { status } });
  if (TERMINAL.includes(status)) {
    await prisma.sequenceEnrollment.updateMany({
      where: { leadId, status: 'active' },
      data: { status: 'stopped', nextActionAt: null },
    });
  }
  await prisma.leadActivity.create({
    data: { leadId, type: status === 'replied' ? 'replied' : 'note', detail: `status -> ${status}` },
  });
  revalidatePath('/leads');
  return { ok: true as const };
}

/** Convert a won lead into a Client; returns the new client id. */
export async function convertLead(leadId: string) {
  await requireUser();
  const client = await convertLeadToClient(leadId);
  revalidatePath('/leads');
  revalidatePath('/clients');
  return { ok: true as const, clientId: client?.id };
}

/** Seed sequences (if needed) and enroll every segment's leads. */
export async function setupAndEnroll() {
  await requireUser();
  await seedSequences();
  let enrolled = 0;
  for (const s of segments) enrolled += (await enrollSegment(s.key)).enrolled;
  revalidatePath('/leads');
  return { ok: true as const, enrolled };
}

/** Process all due outreach touches now. */
export async function runOutreachNow() {
  await requireUser();
  const result = await runDue();
  revalidatePath('/leads');
  return { ok: true as const, ...result };
}
