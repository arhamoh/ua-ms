'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut, Clock } from 'lucide-react';
import { checkIn, checkOut, getCheckoutTasksDetailed } from '@/app/actions';
import CheckoutTasks, { type CheckoutTask } from './CheckoutTasks';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

function fmtElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function CheckInOut({ open }: { open: { id: string; checkInAt: string } | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [taskItems, setTaskItems] = useState<CheckoutTask[]>([]);
  const [tasks, setTasks] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!open) return;
    const tick = () => setElapsed(fmtElapsed(Date.now() - new Date(open.checkInAt).getTime()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [open]);

  const doCheckIn = () =>
    start(async () => {
      await checkIn();
      router.refresh();
    });

  const openCheckout = async () => {
    setCheckoutOpen(true);
    setTasks('');
    setTaskItems([]);
    setLoadingTasks(true);
    try {
      setTaskItems(await getCheckoutTasksDetailed());
    } finally {
      setLoadingTasks(false);
    }
  };

  if (!open) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Clock size={16} className="text-slate-400" /> You’re checked out
            </h2>
            <p className="mt-1 text-sm text-slate-500">Start your day when you begin working.</p>
          </div>
          <button
            onClick={doCheckIn}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50"
          >
            <LogIn size={17} /> {pending ? 'Checking in…' : 'Check in'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Checked in since {fmtTime(open.checkInAt)}
          </h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-emerald-900">{elapsed}</p>
        </div>
        {!checkoutOpen && (
          <button
            onClick={openCheckout}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            <LogOut size={17} /> Check out
          </button>
        )}
      </div>

      {checkoutOpen && (
        <form action={checkOut} className="mt-5 border-t border-emerald-200 pt-5">
          <input type="hidden" name="tasks" value={tasks} />
          <CheckoutTasks items={taskItems} loading={loadingTasks} onChange={setTasks} />
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Notes (optional)</span>
            <input name="notes" className={inputCls} placeholder="Anything to flag" />
          </label>
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setCheckoutOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm text-slate-600 hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <LogOut size={16} /> Check out &amp; save
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
