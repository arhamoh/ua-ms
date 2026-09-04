'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Video, ExternalLink, Check, X, Clock, ArrowRight, CalendarClock } from 'lucide-react';
import { approveMeeting, declineMeeting, proposeTime, cancelMeeting } from '@/app/meetings/actions';
import type { MeetingDTO } from '@/lib/meeting-types';

const inputCls = 'rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand focus:outline-none';

function toLocalInput(iso: string | null, tz: string): string {
  if (!iso) return '';
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(iso))
    .reduce((a: Record<string, string>, x) => ((a[x.type] = x.value), a), {});
  return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}
function whenLabel(iso: string | null, tz: string): string {
  if (!iso) return 'No time set';
  return new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz }).format(new Date(iso));
}

const BADGE: Record<string, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DECLINED: 'bg-slate-100 text-slate-500 border-slate-200',
  CANCELLED: 'bg-slate-100 text-slate-400 border-slate-200',
};

export default function MeetingRow({ m, meId, elevated, tz }: { m: MeetingDTO; meId: string; elevated: boolean; tz: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const [timeVal, setTimeVal] = useState(toLocalInput(m.startISO, tz));
  const [dur, setDur] = useState(m.durationMin);
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState('');

  const iAmApprover = m.approverId === meId;
  const iAmRequester = m.requesterId === meId;
  const isPending = m.status === 'REQUESTED';
  const canApprove = isPending && (iAmApprover || elevated);
  const canCancel = (m.status === 'APPROVED' || isPending) && (iAmApprover || iAmRequester || elevated);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setErr('');
      const r = await fn();
      if (r.ok) router.refresh();
      else setErr(r.error ?? 'Something went wrong.');
    });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-800">{m.title}</span>
            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${BADGE[m.status]}`}>
              {m.status === 'REQUESTED' ? 'Pending' : m.status.charAt(0) + m.status.slice(1).toLowerCase()}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> {whenLabel(m.startISO, tz)}</span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">{m.requesterName} <ArrowRight size={11} /> {m.approverName}</span>
            {m.clientName && <><span className="text-slate-300">·</span><span>Client: {m.clientName}</span></>}
          </div>
          {m.attendees.length > 0 && <div className="mt-0.5 text-[11px] text-slate-400">+ {m.attendees.join(', ')}</div>}
          {m.description && <p className="mt-1 text-xs text-slate-500">{m.description}</p>}
          {m.status === 'DECLINED' && m.declineReason && <p className="mt-1 text-xs text-rose-500">Declined: {m.declineReason}</p>}
          {m.proposedByApprover && isPending && <p className="mt-1 text-[11px] text-amber-600">New time proposed — awaiting the requester.</p>}
        </div>

        {m.status === 'APPROVED' && (
          <div className="flex shrink-0 items-center gap-2">
            {m.meetLink && (
              <a href={m.meetLink} target="_blank" rel="noreferrer" title="Join Meet" className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark">
                <Video size={13} /> Join
              </a>
            )}
            {m.googleHtmlLink && (
              <a href={m.googleHtmlLink} target="_blank" rel="noreferrer" title="Open in Google Calendar" className="text-slate-400 hover:text-slate-700">
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Approver controls */}
      {canApprove && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <label className="text-[11px] text-slate-500">
            <span className="mb-0.5 block">{m.startISO ? 'Confirm / adjust time' : 'Pick a time'}</span>
            <input type="datetime-local" value={timeVal} onChange={(e) => setTimeVal(e.target.value)} className={inputCls} />
          </label>
          <label className="text-[11px] text-slate-500">
            <span className="mb-0.5 block">Duration</span>
            <select value={dur} onChange={(e) => setDur(Number(e.target.value))} className={inputCls}>
              {[15, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </label>
          <button
            onClick={() => run(() => approveMeeting(m.id, { startLocal: timeVal || undefined, durationMin: dur }))}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve
          </button>
          <button onClick={() => setShowDecline((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <X size={13} /> Decline
          </button>
        </div>
      )}

      {canApprove && showDecline && (
        <div className="mt-2 flex items-center gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className={`${inputCls} flex-1`} />
          <button onClick={() => run(() => declineMeeting(m.id, reason))} disabled={pending} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50">
            Confirm decline
          </button>
        </div>
      )}

      {/* Requester controls: nudge a new time */}
      {isPending && iAmRequester && !iAmApprover && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <label className="text-[11px] text-slate-500">
            <span className="mb-0.5 block">Propose a new time</span>
            <input type="datetime-local" value={timeVal} onChange={(e) => setTimeVal(e.target.value)} className={inputCls} />
          </label>
          <button onClick={() => run(() => proposeTime(m.id, timeVal, dur))} disabled={pending || !timeVal} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Clock size={13} /> Propose
          </button>
        </div>
      )}

      {(canCancel || err) && (
        <div className="mt-2 flex items-center gap-3">
          {canCancel && (
            <button onClick={() => { if (confirm('Cancel this meeting?')) run(() => cancelMeeting(m.id)); }} disabled={pending} className="text-xs font-medium text-slate-400 hover:text-rose-600 disabled:opacity-50">
              {m.status === 'APPROVED' ? 'Cancel meeting' : 'Withdraw'}
            </button>
          )}
          {err && <span className="text-xs text-rose-600">{err}</span>}
        </div>
      )}
    </div>
  );
}
