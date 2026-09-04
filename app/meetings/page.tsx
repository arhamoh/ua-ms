import Link from 'next/link';
import { CalendarClock, Plug, Inbox, Send, CalendarCheck, Eye } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { calendarConfigured } from '@/lib/google-calendar';
import { agencyTz } from '@/lib/tz';
import MeetingCalendar from '@/components/MeetingCalendar';
import MeetingRequestForm from '@/components/MeetingRequestForm';
import MeetingRow from '@/components/MeetingRow';
import type { MeetingDTO, CalEvent } from '@/lib/meeting-types';

export const dynamic = 'force-dynamic';

const isElevated = (roles: string[]) => roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN');

export default async function MeetingsPage() {
  const me = await getSession();
  if (!me) return null;
  const elevated = isElevated(me.roles);
  const tz = agencyTz();
  const now = new Date();

  const people = await prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });

  const where = elevated
    ? {}
    : {
        OR: [{ requesterId: me.id }, { approverId: me.id }, { attendees: { some: { userId: me.id } } }],
      };

  const rows = await prisma.meeting.findMany({
    where,
    include: {
      requester: { select: { name: true } },
      approver: { select: { name: true } },
      attendees: { include: { user: { select: { name: true } } } },
    },
    orderBy: { startAt: 'asc' },
  });

  const dtos: MeetingDTO[] = rows.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    clientName: m.clientName,
    status: m.status,
    startISO: m.startAt?.toISOString() ?? null,
    endISO: m.endAt?.toISOString() ?? null,
    durationMin: m.durationMin,
    proposedByApprover: m.proposedByApprover,
    declineReason: m.declineReason,
    withMeet: m.withMeet,
    meetLink: m.meetLink,
    googleHtmlLink: m.googleHtmlLink,
    requesterId: m.requesterId,
    requesterName: m.requester.name,
    approverId: m.approverId,
    approverName: m.approver.name,
    attendees: m.attendees.map((a) => a.user?.name ?? a.email).filter((x): x is string => !!x),
  }));

  const calEvents: CalEvent[] = dtos
    .filter((d) => d.startISO && d.endISO && (d.status === 'APPROVED' || d.status === 'REQUESTED'))
    .map((d) => ({ id: d.id, title: d.title, startISO: d.startISO!, endISO: d.endISO!, status: d.status, meetLink: d.meetLink }));

  const pendingForMe = dtos.filter((d) => d.status === 'REQUESTED' && d.approverId === me.id);
  const myRequests = dtos.filter((d) => d.status === 'REQUESTED' && d.requesterId === me.id && d.approverId !== me.id);
  const upcoming = dtos
    .filter((d) => d.status === 'APPROVED' && d.startISO && new Date(d.startISO) >= now)
    .sort((a, b) => new Date(a.startISO!).getTime() - new Date(b.startISO!).getTime());
  const othersPending = elevated
    ? dtos.filter((d) => d.status === 'REQUESTED' && d.approverId !== me.id && d.requesterId !== me.id)
    : [];

  const Section = ({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) =>
    count === 0 ? null : (
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {icon} {title} <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{count}</span>
        </div>
        <div className="space-y-2">{children}</div>
      </div>
    );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Request meetings, approve them, and see the whole calendar.{elevated ? ' You can see everyone’s meetings.' : ''}
          </p>
        </div>
      </div>

      {!calendarConfigured() && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <Plug size={15} />
          Meetings work now (in-platform + email invites). Connect Google Calendar in Settings to auto-generate Meet links and sync to Google.
          <Link href="/settings" className="font-medium underline">Settings</Link>
        </div>
      )}

      <div className="mt-6">
        <MeetingCalendar events={calEvents} tz={tz} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MeetingRequestForm people={people} meId={me.id} tz={tz} />

        <div className="space-y-6">
          <Section icon={<Inbox size={13} />} title="Awaiting your approval" count={pendingForMe.length}>
            {pendingForMe.map((m) => <MeetingRow key={m.id} m={m} meId={me.id} elevated={elevated} tz={tz} />)}
          </Section>
          <Section icon={<Send size={13} />} title="Your requests" count={myRequests.length}>
            {myRequests.map((m) => <MeetingRow key={m.id} m={m} meId={me.id} elevated={elevated} tz={tz} />)}
          </Section>
          <Section icon={<CalendarCheck size={13} />} title="Upcoming" count={upcoming.length}>
            {upcoming.map((m) => <MeetingRow key={m.id} m={m} meId={me.id} elevated={elevated} tz={tz} />)}
          </Section>
          <Section icon={<Eye size={13} />} title="Pending across the team" count={othersPending.length}>
            {othersPending.map((m) => <MeetingRow key={m.id} m={m} meId={me.id} elevated={elevated} tz={tz} />)}
          </Section>

          {pendingForMe.length + myRequests.length + upcoming.length + othersPending.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              <CalendarClock size={24} className="mx-auto mb-2 text-slate-300" />
              No meetings yet. Use “Request a meeting” to schedule one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
