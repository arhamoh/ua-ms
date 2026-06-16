'use client';

import { useState } from 'react';
import Link from 'next/link';
import { updateTimeEntry } from '@/app/actions';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

// ISO (UTC) → value for <input type="datetime-local"> in the viewer's local time.
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
// local datetime-local value → ISO (UTC) for the hidden field the server reads.
function toIso(local: string): string {
  if (!local) return '';
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

export default function TimeEntryEditForm({
  id,
  from,
  checkInAt,
  checkOutAt,
  tasks,
  notes,
}: {
  id: string;
  from: string;
  checkInAt: string;
  checkOutAt: string | null;
  tasks: string;
  notes: string;
}) {
  const [inLocal, setInLocal] = useState(toLocalInput(checkInAt));
  const [outLocal, setOutLocal] = useState(toLocalInput(checkOutAt));

  return (
    <form action={updateTimeEntry} className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="from" value={from} />
      {/* Hidden ISO mirrors so the server gets UTC regardless of its timezone. */}
      <input type="hidden" name="checkInAt" value={toIso(inLocal)} />
      <input type="hidden" name="checkOutAt" value={toIso(outLocal)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Check in *</span>
          <input type="datetime-local" required value={inLocal} onChange={(e) => setInLocal(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Check out</span>
          <input type="datetime-local" value={outLocal} onChange={(e) => setOutLocal(e.target.value)} className={inputCls} />
          <span className="mt-1 block text-xs text-slate-400">Leave blank to keep the session open. Hours recalculate automatically.</span>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Tasks done</span>
        <textarea name="tasks" rows={5} defaultValue={tasks} className={inputCls} placeholder="What was done this session" />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Notes</span>
        <input name="notes" defaultValue={notes} className={inputCls} placeholder="Optional" />
      </label>

      <div className="mt-5 flex items-center justify-end gap-3">
        <Link href={from} className="rounded-xl px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</Link>
        <button type="submit" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark">
          Save changes
        </button>
      </div>
    </form>
  );
}
