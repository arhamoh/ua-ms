'use client';

import { useState, useTransition } from 'react';
import { CalendarPlus, Loader2, Video, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { scheduleMeeting, type ScheduleResult } from '@/app/meetings/actions';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

export default function MeetingScheduler({ tz }: { tz: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [withMeet, setWithMeet] = useState(true);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    start(async () => {
      setResult(null);
      const r = await scheduleMeeting({
        title: String(fd.get('title') ?? ''),
        startLocal: String(fd.get('startLocal') ?? ''),
        durationMin: Number(fd.get('durationMin') ?? 30),
        attendees: String(fd.get('attendees') ?? ''),
        description: String(fd.get('description') ?? ''),
        withMeet,
      });
      setResult(r);
      if (r.ok) form.reset();
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <CalendarPlus size={18} className="text-brand" />
        <h2 className="text-sm font-semibold">Schedule a meeting</h2>
      </div>
      <p className="mt-1 text-xs text-slate-500">Times are in {tz}. Attendees get a calendar invite by email.</p>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Title *</span>
        <input name="title" required className={inputCls} placeholder="Discovery call — Acme Inc." />
      </label>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Starts *</span>
          <input name="startLocal" type="datetime-local" required className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Duration</span>
          <select name="durationMin" defaultValue="30" className={inputCls}>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
          </select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Attendees</span>
        <input name="attendees" className={inputCls} placeholder="client@acme.com, teammate@agency.com" />
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Notes</span>
        <textarea name="description" rows={2} className={inputCls} placeholder="Agenda, context…" />
      </label>

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={withMeet} onChange={(e) => setWithMeet(e.target.checked)} className="rounded border-slate-300" />
        <Video size={15} className="text-slate-500" /> Add a Google Meet link
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <CalendarPlus size={15} />} Schedule
      </button>

      {result && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
          {result.ok ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <CheckCircle2 size={14} /> Meeting created.
              {result.meetLink && (
                <a href={result.meetLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline">
                  <Video size={13} /> Meet link
                </a>
              )}
              {result.htmlLink && (
                <a href={result.htmlLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline">
                  <ExternalLink size={13} /> Open in Calendar
                </a>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1"><AlertTriangle size={14} /> {result.error}</span>
          )}
        </div>
      )}
    </form>
  );
}
