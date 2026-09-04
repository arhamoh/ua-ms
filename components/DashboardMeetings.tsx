import Link from 'next/link';
import { CalendarClock, Video } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { agencyTz } from '@/lib/tz';

// Compact upcoming-meetings card for the dashboard, linking to the full calendar.
export default async function DashboardMeetings() {
  const me = await getSession();
  if (!me) return null;
  const elevated = me.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN');
  const tz = agencyTz();
  const now = new Date();
  const scope = elevated
    ? {}
    : { OR: [{ requesterId: me.id }, { approverId: me.id }, { attendees: { some: { userId: me.id } } }] };

  const [upcoming, pendingCount] = await Promise.all([
    prisma.meeting.findMany({
      where: { AND: [scope, { status: 'APPROVED' }, { startAt: { gte: now } }] },
      include: { requester: { select: { name: true } }, approver: { select: { name: true } } },
      orderBy: { startAt: 'asc' },
      take: 5,
    }),
    prisma.meeting.count({ where: { approverId: me.id, status: 'REQUESTED' } }),
  ]);

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz }).format(d);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <CalendarClock size={16} className="text-brand" /> Upcoming meetings
        </h2>
        <Link href="/meetings" className="text-xs font-medium text-brand hover:underline">Open calendar</Link>
      </div>
      <div className="px-5 py-4">
        {pendingCount > 0 && (
          <Link href="/meetings" className="mb-3 inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100">
            {pendingCount} awaiting your approval →
          </Link>
        )}
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">
            No upcoming meetings. <Link href="/meetings" className="text-brand hover:underline">Schedule one</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {upcoming.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800">{m.title}</div>
                  <div className="text-xs text-slate-500">{m.startAt ? fmt(m.startAt) : ''} · {m.requester.name} → {m.approver.name}</div>
                </div>
                {m.meetLink && (
                  <a href={m.meetLink} target="_blank" rel="noreferrer" className="shrink-0 text-brand hover:text-brand-dark" title="Join Meet">
                    <Video size={16} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
