import { prisma } from '@/lib/prisma';
import { notifyUsers } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import { agencyTz } from '@/lib/tz';

// Notify participants shortly before an approved meeting starts. Runs on the
// cron; MEETING_REMINDER_LEAD_MIN controls how far ahead (default 30 min).
// reminderSentAt guards against sending twice.
export async function sendDueMeetingReminders(): Promise<{ reminded: number }> {
  const leadMin = Number(process.env.MEETING_REMINDER_LEAD_MIN ?? 30);
  const now = new Date();
  const until = new Date(now.getTime() + leadMin * 60000);

  const due = await prisma.meeting.findMany({
    where: { status: 'APPROVED', reminderSentAt: null, startAt: { gte: now, lte: until } },
    include: { requester: true, approver: true, attendees: { include: { user: true } } },
  });
  if (due.length === 0) return { reminded: 0 };

  const tz = agencyTz();
  for (const m of due) {
    if (!m.startAt) continue;
    const when = new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(m.startAt);
    const ids = Array.from(
      new Set([m.requesterId, m.approverId, ...m.attendees.map((a) => a.userId).filter((x): x is string => !!x)]),
    );
    await notifyUsers(ids, {
      type: 'meeting_reminder',
      title: `Reminder: ${m.title}`,
      body: `Starts at ${when}${m.meetLink ? ' · Google Meet ready' : ''}`,
      href: '/meetings',
    });

    const emails = Array.from(
      new Set([m.requester.email, m.approver.email, ...m.attendees.map((a) => a.user?.email ?? a.email)].filter((x): x is string => !!x && x.includes('@'))),
    );
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#334155;">
      <p>Reminder — your meeting <strong>${escapeHtml(m.title)}</strong> starts at <strong>${escapeHtml(when)}</strong>.</p>
      ${m.meetLink ? `<p><a href="${escapeHtml(m.meetLink)}">Join Google Meet</a></p>` : ''}
    </div>`;
    for (const to of emails) await sendEmail({ to, subject: `Reminder: ${m.title} at ${when}`, html });

    await prisma.meeting.update({ where: { id: m.id }, data: { reminderSentAt: new Date() } });
  }
  return { reminded: due.length };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
