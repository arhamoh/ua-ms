import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { segments } from '@/lib/leadgen/icp';
import { hasApolloKey } from '@/lib/leadgen/pipeline';
import LeadsDashboard from './LeadsDashboard';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!user.roles.includes('SUPER_ADMIN')) redirect('/');

  const [total, withEmail, byStatusRaw, bySegmentRaw, leadsRaw] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { NOT: { email: null } } }),
    prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['segment'], _count: { _all: true } }),
    prisma.lead.findMany({
      include: { company: true },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    }),
  ]);

  const byStatus = Object.fromEntries(byStatusRaw.map((s) => [s.status, s._count._all]));
  const bySegment = Object.fromEntries(bySegmentRaw.map((s) => [s.segment ?? 'none', s._count._all]));

  const leads = leadsRaw.map((l) => ({
    id: l.id,
    name: `${l.firstName ?? ''} ${l.lastName ?? ''}`.trim() || '—',
    title: l.title,
    company: l.company?.name ?? '—',
    email: l.email,
    emailStatus: l.emailStatus,
    linkedinUrl: l.linkedinUrl,
    segment: l.segment,
    score: l.score,
    status: l.status,
    convertedClientId: l.convertedClientId,
  }));

  const segmentDefs = segments.map((s) => ({
    key: s.key,
    label: s.label,
    targetTitles: s.targetTitles,
    industries: s.industries,
    employeeRange: s.employeeRange,
    locations: s.locations,
  }));

  return (
    <LeadsDashboard
      stats={{ total, withEmail, byStatus, bySegment }}
      leads={leads}
      segmentDefs={segmentDefs}
      apolloReady={hasApolloKey()}
    />
  );
}
