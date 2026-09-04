'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { notifyUsers } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import { icsAttachment } from '@/lib/ics';
import { agencyTz, zonedTimeToUtc } from '@/lib/tz';
import { calendarConfigured, createEvent, deleteEvent } from '@/lib/google-calendar';

const isElevated = (roles: string[]) => roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN');

function fmtWhen(start: Date, tz: string): string {
  return (
    new Intl.DateTimeFormat('en-CA', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz,
    }).format(start) + ` (${tz.split('/').pop()?.replace('_', ' ')})`
  );
}

function uniqueEmails(list: (string | null | undefined)[]): string[] {
  return Array.from(new Set(list.filter((x): x is string => !!x && x.includes('@'))));
}

// ── shared notify: in-app + push (notifyUsers) and email (optional, with .ics) ──
async function notifyMeeting(
  userIds: string[],
  notif: { type: string; title: string; body?: string; href?: string },
  email?: { subject: string; html: string; attachments?: { filename: string; content: string }[]; extraEmails?: string[] },
) {
  await notifyUsers(userIds, notif);
  if (email) {
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { email: true } });
    const targets = uniqueEmails([...users.map((u) => u.email), ...(email.extraEmails ?? [])]);
    for (const to of targets) {
      await sendEmail({ to, subject: email.subject, html: email.html, attachments: email.attachments });
    }
  }
}

function shell(body: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f1f5f9;padding:24px 0;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <div style="background:#0f5132;padding:18px 24px;"><span style="color:#fff;font-size:20px;font-weight:700;">keel.</span></div>
      <div style="padding:24px;color:#334155;font-size:14px;line-height:1.6;">${body}</div>
    </div></div>`;
}

// ── Request a meeting ────────────────────────────────────────────────────────
export interface RequestMeetingInput {
  approverId: string;
  title: string;
  clientName?: string;
  description?: string;
  startLocal?: string; // 'YYYY-MM-DDTHH:MM' in agency tz; empty = ask availability
  durationMin?: number;
  attendeeIds?: string[];
  attendeeEmails?: string;
  withMeet?: boolean;
}

export async function requestMeeting(input: RequestMeetingInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const me = await getSession();
  if (!me) return { ok: false, error: 'Not signed in.' };
  const title = (input.title ?? '').trim();
  if (!title) return { ok: false, error: 'Add a title.' };
  if (!input.approverId) return { ok: false, error: 'Choose who you want to meet.' };

  const tz = agencyTz();
  const durationMin = Math.max(15, Number(input.durationMin) || 30);
  let startAt: Date | null = null;
  let endAt: Date | null = null;
  if (input.startLocal) {
    startAt = zonedTimeToUtc(input.startLocal, tz);
    endAt = new Date(startAt.getTime() + durationMin * 60000);
  }

  const attendeeIds = Array.from(new Set((input.attendeeIds ?? []).filter(Boolean))).filter(
    (id) => id !== me.id && id !== input.approverId,
  );
  const attendeeEmails = (input.attendeeEmails ?? '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes('@'));

  // Meeting with yourself, at a set time → just book it.
  const selfBook = input.approverId === me.id && !!startAt;

  const meeting = await prisma.meeting.create({
    data: {
      title,
      description: input.description?.trim() || null,
      clientName: input.clientName?.trim() || null,
      status: selfBook ? 'APPROVED' : 'REQUESTED',
      requesterId: me.id,
      approverId: input.approverId,
      startAt,
      endAt,
      durationMin,
      withMeet: input.withMeet ?? true,
      attendees: {
        create: [...attendeeIds.map((userId) => ({ userId })), ...attendeeEmails.map((email) => ({ email }))],
      },
    },
  });

  if (selfBook) {
    await finalizeApproved(meeting.id);
  } else {
    const when = startAt ? fmtWhen(startAt, tz) : 'They asked for your availability — pick a time to confirm.';
    await notifyMeeting(
      [input.approverId],
      {
        type: 'meeting_request',
        title: `Meeting request from ${me.name}`,
        body: `${title}${input.clientName ? ` · ${input.clientName}` : ''} — ${when}`,
        href: '/meetings',
      },
      {
        subject: `Meeting request: ${title}`,
        html: shell(
          `<p><strong>${escapeHtml(me.name)}</strong> requested a meeting with you.</p>
           <p style="margin:12px 0;padding:12px 14px;background:#f8fafc;border-radius:10px;">
             <strong>${escapeHtml(title)}</strong><br/>${escapeHtml(when)}
             ${input.clientName ? `<br/>Client: ${escapeHtml(input.clientName)}` : ''}
             ${input.description ? `<br/><span style="color:#64748b;">${escapeHtml(input.description)}</span>` : ''}
           </p>
           <p>Open Keel → Meetings to approve, decline, or propose a time.</p>`,
        ),
      },
    );
  }

  revalidatePath('/meetings');
  revalidatePath('/');
  return { ok: true, id: meeting.id };
}

// ── Approve (book) ───────────────────────────────────────────────────────────
export async function approveMeeting(
  id: string,
  opts?: { startLocal?: string; durationMin?: number },
): Promise<{ ok: boolean; error?: string }> {
  const me = await getSession();
  if (!me) return { ok: false, error: 'Not signed in.' };
  const m = await prisma.meeting.findUnique({ where: { id } });
  if (!m) return { ok: false, error: 'Meeting not found.' };
  if (m.approverId !== me.id && !isElevated(me.roles)) return { ok: false, error: 'Only the person invited can approve this.' };
  if (m.status !== 'REQUESTED') return { ok: false, error: 'This request is no longer pending.' };

  const tz = agencyTz();
  const durationMin = Math.max(15, Number(opts?.durationMin) || m.durationMin);
  let startAt = m.startAt;
  if (opts?.startLocal) startAt = zonedTimeToUtc(opts.startLocal, tz);
  if (!startAt) return { ok: false, error: 'Pick a date & time to confirm.' };
  const endAt = new Date(startAt.getTime() + durationMin * 60000);

  await prisma.meeting.update({ where: { id }, data: { status: 'APPROVED', startAt, endAt, durationMin } });
  await finalizeApproved(id);
  revalidatePath('/meetings');
  revalidatePath('/');
  return { ok: true };
}

// Create the Google event (if connected) and notify + email everyone with an .ics.
async function finalizeApproved(id: string) {
  const m = await prisma.meeting.findUnique({
    where: { id },
    include: { requester: true, approver: true, attendees: { include: { user: true } } },
  });
  if (!m || !m.startAt || !m.endAt) return;

  const attendeeEmails = uniqueEmails([
    m.requester.email,
    m.approver.email,
    ...m.attendees.map((a) => a.user?.email ?? a.email),
  ]);

  let { meetLink, googleEventId, googleHtmlLink } = m;
  if (calendarConfigured() && !googleEventId) {
    try {
      const ev = await createEvent({
        title: m.title,
        description: m.description,
        startAt: m.startAt,
        endAt: m.endAt,
        attendees: attendeeEmails,
        withMeet: m.withMeet,
      });
      meetLink = ev.meetLink ?? null;
      googleEventId = ev.id;
      googleHtmlLink = ev.htmlLink ?? null;
      await prisma.meeting.update({ where: { id: m.id }, data: { meetLink, googleEventId, googleHtmlLink } });
    } catch {
      /* Google failed — the meeting still stands in-platform. */
    }
  }

  const tz = agencyTz();
  const when = fmtWhen(m.startAt, tz);
  const participantIds = Array.from(
    new Set([m.requesterId, m.approverId, ...m.attendees.map((a) => a.userId).filter((x): x is string => !!x)]),
  );
  const ics = icsAttachment({
    uid: `meeting-${m.id}@keel`,
    title: m.title,
    description: m.description,
    start: m.startAt,
    end: m.endAt,
    organizerEmail: m.approver.email,
    organizerName: m.approver.name,
    attendees: attendeeEmails,
    meetLink,
    status: 'CONFIRMED',
  });
  await notifyMeeting(
    participantIds,
    {
      type: 'meeting_approved',
      title: `Meeting confirmed: ${m.title}`,
      body: `${when}${meetLink ? ' · Google Meet ready' : ''}`,
      href: '/meetings',
    },
    {
      subject: `Confirmed: ${m.title} — ${when}`,
      html: shell(
        `<p>Your meeting is confirmed.</p>
         <p style="margin:12px 0;padding:12px 14px;background:#f8fafc;border-radius:10px;">
           <strong>${escapeHtml(m.title)}</strong><br/>${escapeHtml(when)}
           ${m.clientName ? `<br/>Client: ${escapeHtml(m.clientName)}` : ''}
         </p>
         ${meetLink ? `<p><a href="${escapeHtml(meetLink)}" style="display:inline-block;background:#0f5132;color:#fff;text-decoration:none;padding:9px 16px;border-radius:9px;">Join Google Meet</a></p>` : ''}
         <p style="color:#64748b;font-size:12px;">An invite is attached — add it to your calendar.</p>`,
      ),
      attachments: [ics],
      extraEmails: uniqueEmails(m.attendees.map((a) => a.email)),
    },
  );
}

// ── Decline ──────────────────────────────────────────────────────────────────
export async function declineMeeting(id: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  const me = await getSession();
  if (!me) return { ok: false, error: 'Not signed in.' };
  const m = await prisma.meeting.findUnique({ where: { id }, include: { approver: true } });
  if (!m) return { ok: false, error: 'Meeting not found.' };
  if (m.approverId !== me.id && !isElevated(me.roles)) return { ok: false, error: 'Only the person invited can decline this.' };
  if (m.status !== 'REQUESTED') return { ok: false, error: 'This request is no longer pending.' };

  await prisma.meeting.update({ where: { id }, data: { status: 'DECLINED', declineReason: reason?.trim() || null } });
  await notifyMeeting(
    [m.requesterId],
    {
      type: 'meeting_declined',
      title: `Meeting declined: ${m.title}`,
      body: reason?.trim() ? `Reason: ${reason.trim()}` : `${m.approver.name} declined the request.`,
      href: '/meetings',
    },
    {
      subject: `Declined: ${m.title}`,
      html: shell(
        `<p><strong>${escapeHtml(m.approver.name)}</strong> declined your meeting request “${escapeHtml(m.title)}”.</p>
         ${reason?.trim() ? `<p style="padding:10px 12px;background:#f8fafc;border-radius:8px;">${escapeHtml(reason.trim())}</p>` : ''}`,
      ),
    },
  );
  revalidatePath('/meetings');
  return { ok: true };
}

// ── Propose a new time (either party) ────────────────────────────────────────
export async function proposeTime(id: string, startLocal: string, durationMin?: number): Promise<{ ok: boolean; error?: string }> {
  const me = await getSession();
  if (!me) return { ok: false, error: 'Not signed in.' };
  const m = await prisma.meeting.findUnique({ where: { id }, include: { requester: true, approver: true } });
  if (!m) return { ok: false, error: 'Meeting not found.' };
  const iAmRequester = m.requesterId === me.id;
  const iAmApprover = m.approverId === me.id;
  if (!iAmRequester && !iAmApprover && !isElevated(me.roles)) return { ok: false, error: 'Not your meeting.' };
  if (m.status !== 'REQUESTED') return { ok: false, error: 'This request is no longer pending.' };
  if (!startLocal) return { ok: false, error: 'Pick a date & time.' };

  const tz = agencyTz();
  const dur = Math.max(15, Number(durationMin) || m.durationMin);
  const startAt = zonedTimeToUtc(startLocal, tz);
  await prisma.meeting.update({
    where: { id },
    data: { startAt, endAt: new Date(startAt.getTime() + dur * 60000), durationMin: dur, proposedByApprover: iAmApprover },
  });
  const notifyId = iAmApprover ? m.requesterId : m.approverId;
  await notifyMeeting(
    [notifyId],
    {
      type: 'meeting_proposed',
      title: `New time proposed: ${m.title}`,
      body: `${me.name} proposed ${fmtWhen(startAt, tz)}`,
      href: '/meetings',
    },
    {
      subject: `New time proposed: ${m.title}`,
      html: shell(`<p><strong>${escapeHtml(me.name)}</strong> proposed a new time for “${escapeHtml(m.title)}”: <strong>${escapeHtml(fmtWhen(startAt, tz))}</strong>.</p><p>Open Keel → Meetings to approve.</p>`),
    },
  );
  revalidatePath('/meetings');
  return { ok: true };
}

// ── Cancel a booked (or pending) meeting ─────────────────────────────────────
export async function cancelMeeting(id: string): Promise<{ ok: boolean; error?: string }> {
  const me = await getSession();
  if (!me) return { ok: false, error: 'Not signed in.' };
  const m = await prisma.meeting.findUnique({
    where: { id },
    include: { requester: true, approver: true, attendees: { include: { user: true } } },
  });
  if (!m) return { ok: false, error: 'Meeting not found.' };
  if (m.requesterId !== me.id && m.approverId !== me.id && !isElevated(me.roles)) {
    return { ok: false, error: 'Not your meeting.' };
  }
  if (m.status === 'CANCELLED') return { ok: true };

  if (m.googleEventId) await deleteEvent(m.googleEventId);
  await prisma.meeting.update({ where: { id }, data: { status: 'CANCELLED' } });

  const participantIds = Array.from(
    new Set(
      [m.requesterId, m.approverId, ...m.attendees.map((a) => a.userId).filter((x): x is string => !!x)].filter(
        (uid) => uid !== me.id,
      ),
    ),
  );
  const tz = agencyTz();
  const when = m.startAt ? fmtWhen(m.startAt, tz) : '';
  await notifyMeeting(
    participantIds,
    {
      type: 'meeting_cancelled',
      title: `Meeting cancelled: ${m.title}`,
      body: `${me.name} cancelled${when ? ` — was ${when}` : ''}.`,
      href: '/meetings',
    },
    {
      subject: `Cancelled: ${m.title}`,
      html: shell(`<p><strong>${escapeHtml(me.name)}</strong> cancelled the meeting “${escapeHtml(m.title)}”${when ? ` (${escapeHtml(when)})` : ''}.</p>`),
      extraEmails: uniqueEmails(m.attendees.map((a) => a.email)),
    },
  );
  revalidatePath('/meetings');
  revalidatePath('/');
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
