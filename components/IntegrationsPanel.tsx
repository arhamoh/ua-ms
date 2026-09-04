'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Plug, Save, Trash2, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { testIntegration, saveIntegrationSecret, clearIntegrationSecret, revealSecret } from '@/app/actions';
import type { IntegrationStatus, EnvVarStatus } from '@/lib/integrations';

const STATUS: Record<IntegrationStatus['status'], { dot: string; label: string; cls: string }> = {
  connected: { dot: 'bg-emerald-500', label: 'Connected', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  warn: { dot: 'bg-amber-500', label: 'Action needed', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  off: { dot: 'bg-slate-300', label: 'Not configured', cls: 'border-slate-200 bg-slate-50 text-slate-500' },
};

// Groups rendered as a single combined card (one border, sub-sections inside).
const MERGED_GROUPS = new Set(['Google']);

export default function IntegrationsPanel({ integrations }: { integrations: IntegrationStatus[] }) {
  // Collapse into consecutive same-group runs.
  const groups: { group: string; items: IntegrationStatus[] }[] = [];
  for (const it of integrations) {
    const last = groups[groups.length - 1];
    if (last && last.group === it.group) last.items.push(it);
    else groups.push({ group: it.group, items: [it] });
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.group}>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.group}</h4>
          {MERGED_GROUPS.has(g.group) ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {g.items.map((it, i) => (
                <div key={it.id} className={i > 0 ? 'border-t border-slate-100 pt-4' : ''}>
                  <IntegrationBody it={it} />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {g.items.map((it) => (
                <div key={it.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <IntegrationBody it={it} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// The inner content of one integration — no outer border, so it works both as
// its own card and as a section inside a merged card.
function IntegrationBody({ it }: { it: IntegrationStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [msg, setMsg] = useState('');
  const s = STATUS[it.status];

  const runTest = () =>
    start(async () => {
      setResult(null);
      setResult(await testIntegration(it.id));
    });

  return (
    <div>
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
            title={v.set ? (v.saved ? 'Set (saved here)' : 'Set (from environment)') : v.required ? 'Missing (required)' : 'Not set (optional)'}
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

      {/* Editable keys — set them right here instead of via the server env. */}
      {it.vars.some((v) => v.editable) && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {it.vars.filter((v) => v.editable).map((v) => (
            <SecretRow key={v.name} v={v} onDone={(m) => { setMsg(m); router.refresh(); }} />
          ))}
          {msg && <p className="text-[11px] text-slate-500">{msg}</p>}
        </div>
      )}

      {it.testable && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
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

function SecretRow({ v, onDone }: { v: EnvVarStatus; onDone: (msg: string) => void }) {
  const [pending, start] = useTransition();
  const [revealing, setRevealing] = useState(false);
  const [shown, setShown] = useState(false); // showing the current value in clear text
  const [val, setVal] = useState('');

  const save = () =>
    start(async () => {
      const r = await saveIntegrationSecret(v.name, val);
      setVal('');
      setShown(false);
      onDone(r.message);
    });
  const clear = () =>
    start(async () => {
      const r = await clearIntegrationSecret(v.name);
      setVal('');
      setShown(false);
      onDone(r.message);
    });

  const toggleReveal = async () => {
    if (shown) {
      setShown(false);
      setVal('');
      return;
    }
    setRevealing(true);
    const r = await revealSecret(v.name);
    setRevealing(false);
    if (r.ok && r.value != null) {
      setVal(r.value);
      setShown(true);
    } else {
      onDone(r.message ?? 'Nothing to show.');
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <label className="w-44 shrink-0 truncate font-mono text-[10px] text-slate-500" title={v.name}>{v.name}</label>
      <input
        type={shown ? 'text' : 'password'}
        value={val}
        onChange={(e) => { setVal(e.target.value); setShown(true); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && val.trim()) save(); }}
        placeholder={v.saved ? '•••••••• saved — reveal or replace' : v.set ? '•••••••• set via environment' : 'not set'}
        autoComplete="off"
        className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-brand focus:outline-none"
      />
      {v.set && (
        <button
          onClick={toggleReveal}
          disabled={pending || revealing}
          title={shown ? 'Hide' : 'Reveal current value'}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-40"
        >
          {revealing ? <Loader2 size={12} className="animate-spin" /> : shown ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      )}
      <button onClick={save} disabled={pending || !val.trim()} title="Save" className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand text-white hover:bg-brand-dark disabled:opacity-40">
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
      </button>
      {v.saved && (
        <button onClick={clear} disabled={pending} title="Clear saved value" className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-400 hover:text-rose-600 disabled:opacity-40">
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}
