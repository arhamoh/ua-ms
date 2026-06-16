'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Plug } from 'lucide-react';
import { testIntegration } from '@/app/actions';
import type { IntegrationStatus } from '@/lib/integrations';

const STATUS: Record<IntegrationStatus['status'], { dot: string; label: string; cls: string }> = {
  connected: { dot: 'bg-emerald-500', label: 'Connected', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  warn: { dot: 'bg-amber-500', label: 'Action needed', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  off: { dot: 'bg-slate-300', label: 'Not configured', cls: 'border-slate-200 bg-slate-50 text-slate-500' },
};

export default function IntegrationsPanel({ integrations }: { integrations: IntegrationStatus[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {integrations.map((it) => (
        <Card key={it.id} it={it} />
      ))}
    </div>
  );
}

function Card({ it }: { it: IntegrationStatus }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const s = STATUS[it.status];

  const runTest = () =>
    start(async () => {
      setResult(null);
      setResult(await testIntegration(it.id));
    });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">{it.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{it.description}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-600">{it.summary}</p>

      <div className="mt-2.5 flex flex-wrap gap-1">
        {it.vars.map((v) => (
          <span
            key={v.name}
            title={v.set ? 'Set' : v.required ? 'Missing (required)' : 'Not set (optional)'}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${
              v.set
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : v.required
                  ? 'border-rose-200 bg-rose-50 text-rose-600'
                  : 'border-slate-200 bg-slate-50 text-slate-400'
            }`}
          >
            {v.set ? <CheckCircle2 size={10} /> : <XCircle size={10} />} {v.name}
          </span>
        ))}
      </div>

      {it.testable && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={runTest}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />} Test connection
          </button>
          {result && (
            <span className={`inline-flex items-center gap-1 text-xs ${result.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
              {result.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {result.message}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
