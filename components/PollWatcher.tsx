'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { pollStatus } from '@/app/leads/actions';

// Global watcher (mounted in the app shell, so it survives navigation): when a
// background X poll finishes, it shows a toast — even if you've left the page.

type Toast = { kind: 'done' | 'err'; text: string } | null;

export default function PollWatcher() {
  const router = useRouter();
  const [toast, setToast] = useState<Toast>(null);
  const watching = useRef(false);
  const lastFinished = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    watching.current = false;
  };

  const tick = async () => {
    let s;
    try { s = await pollStatus(); } catch { return; }
    if (s.running) return;
    if (s.finishedAt && s.finishedAt !== lastFinished.current) {
      lastFinished.current = s.finishedAt;
      if (s.error) setToast({ kind: 'err', text: `Poll failed: ${s.error}` });
      else if (s.result) setToast({ kind: 'done', text: `Fetch complete — ${s.result.created} new tweet(s), ${s.result.scored} scored, ${s.result.notified} alert(s).` });
      else setToast({ kind: 'done', text: 'Fetch complete.' });
      // Let any open page (e.g. the X page) react live.
      window.dispatchEvent(new CustomEvent('keel:poll-finished', { detail: s }));
      router.refresh();
    }
    stop();
  };

  const startWatch = () => {
    if (watching.current) return;
    watching.current = true;
    timer.current = setInterval(tick, 3000);
  };

  useEffect(() => {
    // Resume if a poll is already running (e.g. reloaded mid-poll).
    (async () => {
      try {
        const s = await pollStatus();
        lastFinished.current = s.finishedAt;
        if (s.running) startWatch();
      } catch { /* not signed in / not available */ }
    })();
    const onStart = () => startWatch();
    window.addEventListener('keel:poll-started', onStart);
    return () => { window.removeEventListener('keel:poll-started', onStart); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex max-w-sm items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      {toast.kind === 'done' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-600" />}
      <p className="text-sm text-slate-700">{toast.text}</p>
      <button onClick={() => setToast(null)} className="ml-1 shrink-0 text-slate-400 hover:text-slate-600"><X size={15} /></button>
    </div>
  );
}
