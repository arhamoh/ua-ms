'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { reclassifyCreditCardPayments } from '@/app/actions';

export default function ReclassifyCCButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);

  const run = () =>
    start(async () => {
      setRes(null);
      const r = await reclassifyCreditCardPayments();
      setRes(r);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={run}
        disabled={pending}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-50 disabled:opacity-50"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Reclassify old CC payments
      </button>
      {res && (
        <span className={`inline-flex items-center gap-1 text-xs ${res.ok ? 'text-emerald-700' : 'text-rose-600'}`}>
          {res.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {res.message}
        </span>
      )}
    </div>
  );
}
