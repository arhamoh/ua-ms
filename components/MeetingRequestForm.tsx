'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Loader2, Video, CheckCircle2, AlertTriangle } from 'lucide-react';
import { requestMeeting } from '@/app/meetings/actions';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

export default function MeetingRequestForm({ people, meId, tz }: { people: { id: string; name: string }[]; meId: string; tz: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<'time' | 'availability'>('time');
  const [withMeet, setWithMeet] = useState(true);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    start(async () => {
      setResult(null);
      const r = await requestMeeting({
        approverId: String(fd.get('approverId') ?? ''),
        title: String(fd.get('title') ?? ''),
        clientName: String(fd.get('clientName') ?? ''),
        description: String(fd.get('description') ?? ''),
        startLocal: mode === 'time' ? String(fd.get('startLocal') ?? '') : '',
        durationMin: Number(fd.get('durationMin') ?? 30),
        attendeeEmails: String(fd.get('attendeeEmails') ?? ''),
        withMeet,
      });
      setResult(r);
      if (r.ok) {
        form.reset();
        setMode('time');
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <CalendarPlus size={18} className="text-brand" />
        <h2 className="text-sm font-semibold">Request a meeting</h2>
      </div>
      <p className="mt-1 text-xs text-slate-500">They’ll be asked to approve. Times are in {tz}.</p>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Title *</span>
        <input name="title" required className={inputCls} placeholder="Discovery call — Acme Inc." />
      </label>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Meet with *</span>
          <select name="approverId" required defaultValue="" className={inputCls}>
            <option value="" disabled>Choose a person…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.id === meId ? ' (you)' : ''}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Potential client</span>
          <input name="clientName" className={inputCls} placeholder="Acme Inc. (optional)" />
        </label>
      </div>

      <div className="mt-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
        <button type="button" onClick={() => setMode('time')} className={`rounded-md px-3 py-1.5 font-medium ${mode === 'time' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
          Propose a time
        </button>
        <button type="button" onClick={() => setMode('availability')} className={`rounded-md px-3 py-1.5 font-medium ${mode === 'availability' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
          Ask their availability
        </button>
      </div>

      {mode === 'time' ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Starts *</span>
            <input name="startLocal" type="datetime-local" required={mode === 'time'} className={inputCls} />
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
      ) : (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          No time is set — they’ll pick a slot that works and confirm. Duration defaults to 30 min.
        </p>
      )}

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Other attendees</span>
        <input name="attendeeEmails" className={inputCls} placeholder="client@acme.com, teammate@agency.com" />
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Notes</span>
        <textarea name="description" rows={2} className={inputCls} placeholder="What’s this about?" />
      </label>

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={withMeet} onChange={(e) => setWithMeet(e.target.checked)} className="rounded border-slate-300" />
        <Video size={15} className="text-slate-500" /> Add a Google Meet link when confirmed
      </label>

      <button type="submit" disabled={pending} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <CalendarPlus size={15} />} Send request
      </button>

      {result && (
        <p className={`mt-3 inline-flex items-center gap-1 text-xs ${result.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
          {result.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {result.ok ? 'Request sent.' : result.error}
        </p>
      )}
    </form>
  );
}
