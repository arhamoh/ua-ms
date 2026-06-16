'use client';

import { useState, useTransition } from 'react';
import { Database, Loader2, Check, AlertTriangle } from 'lucide-react';
import { runMigrations } from '@/app/actions';

type Result = { ok: boolean; output: string };

/**
 * Triggers `prisma migrate deploy` (super-admin only, enforced server-side).
 * `header` = compact icon button for the top bar; `full` = button + output log.
 */
export default function MigrationButton({ variant = 'full' }: { variant?: 'full' | 'header' }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  const run = () =>
    start(async () => {
      setResult(null);
      setResult(await runMigrations());
    });

  if (variant === 'header') {
    const title = pending
      ? 'Running migrations…'
      : result
        ? result.ok
          ? 'Migrations applied'
          : 'Migration failed — open Settings → Database'
        : 'Run database migrations';
    return (
      <button
        onClick={run}
        disabled={pending}
        title={title}
        aria-label="Run database migrations"
        className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand disabled:opacity-50"
      >
        {pending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : result ? (
          result.ok ? (
            <Check size={16} className="text-emerald-600" />
          ) : (
            <AlertTriangle size={16} className="text-rose-600" />
          )
        ) : (
          <Database size={16} />
        )}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
        {pending ? 'Running migrations…' : 'Run migrations'}
      </button>
      {result && (
        <pre
          className={`mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border p-3 text-xs leading-relaxed ${
            result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {result.output}
        </pre>
      )}
    </div>
  );
}
