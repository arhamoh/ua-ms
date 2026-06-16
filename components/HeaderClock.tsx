'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut } from 'lucide-react';
import { attendanceStatus, checkIn, quickCheckOut } from '@/app/actions';

function fmtElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export default function HeaderClock() {
  const router = useRouter();
  const [status, setStatus] = useState<{ open: boolean; checkInAt: string | null } | null>(null);
  const [elapsed, setElapsed] = useState('');
  const [pending, start] = useTransition();

  const load = useCallback(() => {
    attendanceStatus().then(setStatus).catch(() => setStatus({ open: false, checkInAt: null }));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live timer while checked in.
  useEffect(() => {
    if (!status?.open || !status.checkInAt) return;
    const tick = () => setElapsed(fmtElapsed(Date.now() - new Date(status.checkInAt!).getTime()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [status]);

  const onCheckIn = () =>
    start(async () => {
      await checkIn();
      load();
      router.refresh();
    });

  const onCheckOut = () =>
    start(async () => {
      await quickCheckOut();
      load();
      router.refresh();
    });

  // Until we know the status, render nothing (avoids a flash).
  if (!status) return null;

  if (status.open) {
    return (
      <button
        onClick={onCheckOut}
        disabled={pending}
        title="Check out (saves today’s tasks)"
        className="group inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="tabular-nums">{elapsed}</span>
        <LogOut size={15} className="opacity-60 group-hover:opacity-100" />
        <span className="sr-only">Check out</span>
      </button>
    );
  }

  return (
    <button
      onClick={onCheckIn}
      disabled={pending}
      title="Check in"
      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-brand disabled:opacity-50"
    >
      <LogIn size={16} />
      <span className="hidden sm:inline">{pending ? 'Checking in…' : 'Check in'}</span>
    </button>
  );
}
