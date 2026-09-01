'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { importWaveInvoices } from '@/app/actions';

export default function WaveImportButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);

  const run = () =>
    start(async () => {
      setRes(null);
      const r = await importWaveInvoices();
      setRes(r);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Import from Wave
      </button>
      {res && (
        <span className={`inline-flex items-center gap-1 text-xs ${res.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
          {res.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {res.message}
        </span>
      )}
    </div>
  );
}
