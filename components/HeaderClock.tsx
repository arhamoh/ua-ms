'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { LogIn, LogOut, Loader2, Sparkles, X } from 'lucide-react';
import { checkIn, checkOut, getCheckoutTasks, recordActivity } from '@/app/actions';

const HEARTBEAT_MS = 60_000; // send an active beat at most once a minute
const ACTIVE_WINDOW_MS = 180_000; // interaction within 3 min still counts as active
const IDLE_DOT_MS = 300_000; // dot goes amber after 5 min with no input

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

function fmtElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

type Status = { open: boolean; checkInAt: string | null };

export default function HeaderClock({ initial }: { initial: Status }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initial);
  const [elapsed, setElapsed] = useState('');
  const [pending, start] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [tasks, setTasks] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [idle, setIdle] = useState(false);
  const lastActivityRef = useRef(Date.now());

  // Keep in sync with the server (updates whenever a route calls router.refresh,
  // e.g. checking in from the Time page).
  useEffect(() => {
    setStatus(initial);
  }, [initial.open, initial.checkInAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch for real interaction while checked in (used for idle detection).
  useEffect(() => {
    if (!status.open) return;
    const mark = () => { lastActivityRef.current = Date.now(); };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const onVisible = () => { if (document.visibilityState === 'visible') mark(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [status.open]);

  // Live timer + idle flag while checked in.
  useEffect(() => {
    if (!status.open || !status.checkInAt) return;
    const tick = () => {
      setElapsed(fmtElapsed(Date.now() - new Date(status.checkInAt!).getTime()));
      setIdle(Date.now() - lastActivityRef.current > IDLE_DOT_MS);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [status]);

  // Heartbeat: count this minute as active only if the tab is visible and the
  // user interacted recently. Idle minutes simply aren't counted.
  useEffect(() => {
    if (!status.open) return;
    const beat = () => {
      const active = document.visibilityState === 'visible' && Date.now() - lastActivityRef.current <= ACTIVE_WINDOW_MS;
      if (active) recordActivity(HEARTBEAT_MS / 1000).catch(() => {});
    };
    const t = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [status.open]);

  const onCheckIn = () =>
    start(async () => {
      await checkIn();
      router.refresh();
    });

  const openModal = async () => {
    setModalOpen(true);
    setNotes('');
    setLoadingTasks(true);
    try {
      setTasks(await getCheckoutTasks());
    } finally {
      setLoadingTasks(false);
    }
  };

  const confirmCheckOut = () =>
    start(async () => {
      const fd = new FormData();
      fd.set('tasks', tasks);
      fd.set('notes', notes);
      await checkOut(fd);
      setModalOpen(false);
      setStatus({ open: false, checkInAt: null });
      router.refresh();
    });

  return (
    <>
      {status.open ? (
        <button
          onClick={openModal}
          title={idle ? 'Idle — no activity detected. Click to check out.' : 'Active — click to check out'}
          className={`group inline-flex items-center gap-2 rounded-xl border px-2.5 py-2 text-sm font-medium transition ${
            idle
              ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          {idle ? (
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          )}
          <span className="tabular-nums">{elapsed}</span>
          {idle && <span className="hidden text-xs font-normal sm:inline">idle</span>}
          <LogOut size={15} className="opacity-60 group-hover:opacity-100" />
        </button>
      ) : (
        <button
          onClick={onCheckIn}
          disabled={pending}
          title="Check in"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-brand disabled:opacity-50"
        >
          <LogIn size={16} />
          <span className="hidden sm:inline">{pending ? 'Checking in…' : 'Check in'}</span>
        </button>
      )}

      {/* Checkout prompt — review the day's tasks before checking out */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !pending && setModalOpen(false)} />
            <motion.div
              className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <button onClick={() => setModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
              <h2 className="text-base font-semibold tracking-tight">Check out</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {status.checkInAt
                  ? `${elapsed} this session. Review what you did, then check out.`
                  : 'Review what you did, then check out.'}
              </p>

              <label className="mt-4 block">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <Sparkles size={13} className="text-brand" /> Tasks done today
                  {loadingTasks && <Loader2 size={12} className="animate-spin text-slate-400" />}
                </span>
                <textarea
                  rows={6}
                  value={tasks}
                  onChange={(e) => setTasks(e.target.value)}
                  placeholder="Auto-filled from the tasks you changed today — add anything else here."
                  className={inputCls}
                />
                <span className="mt-1 block text-xs text-slate-400">Pre-filled from your task changes since check-in. Edit or add freely.</span>
              </label>

              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Notes (optional)</span>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Anything to flag" />
              </label>

              <div className="mt-5 flex items-center justify-end gap-3">
                <button onClick={() => setModalOpen(false)} disabled={pending} className="rounded-xl px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                  Cancel
                </button>
                <button
                  onClick={confirmCheckOut}
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                >
                  <LogOut size={16} /> {pending ? 'Checking out…' : 'Check out & save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
