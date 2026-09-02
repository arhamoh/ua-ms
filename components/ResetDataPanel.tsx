'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { resetData } from '@/app/actions';

type Scope = { key: string; label: string; desc: string; heavy?: boolean };

// Number-only categories first; entity-removing ones flagged `heavy`.
const NUMBERS: Scope[] = [
  { key: 'finance', label: 'Income & expenses', desc: 'Client payments, other income, expenses, and transfers — the P&L and GST numbers.' },
  { key: 'invoices', label: 'Invoices', desc: 'All invoices (payments are kept but unlinked).' },
  { key: 'statements', label: 'Statements & import memory', desc: 'Archived statement files, pending imports, and learned categorization rules.' },
  { key: 'filings', label: 'GST/QST filings', desc: 'Quarterly remittance state (received / filed toggles and income overrides).' },
  { key: 'loans', label: 'Loans', desc: 'The money-to-recover ledger.' },
  { key: 'commissions', label: 'Commission payouts', desc: 'Recorded commission payments.' },
  { key: 'salaryPayments', label: 'Salary payments', desc: 'Recorded salary payments (salary structure is kept).' },
  { key: 'time', label: 'Time entries', desc: 'Check-ins / check-outs and the activity log.' },
];
const HEAVY: Scope[] = [
  { key: 'leads', label: 'Leads', desc: 'Sourced leads, companies, activity, and sequence enrollments.', heavy: true },
  { key: 'projects', label: 'Projects', desc: 'All projects and their tasks, files, and members.', heavy: true },
  { key: 'clients', label: 'Clients', desc: 'All clients — also removes their projects, invoices, and payments.', heavy: true },
];

export default function ResetDataPanel() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [word, setWord] = useState('');
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);

  const toggle = (k: string) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const selectedHeavy = HEAVY.some((s) => sel.has(s.key));

  const run = () =>
    start(async () => {
      const r = await resetData([...sel]);
      setRes(r);
      setConfirming(false);
      setWord('');
      setSel(new Set());
      router.refresh();
    });

  const Row = ({ s }: { s: Scope }) => (
    <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${sel.has(s.key) ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
      <input type="checkbox" checked={sel.has(s.key)} onChange={() => toggle(s.key)} className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{s.label} {s.heavy && <span className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-700">removes records</span>}</span>
        <span className="block text-xs text-slate-500">{s.desc}</span>
      </span>
    </label>
  );

  return (
    <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-rose-600" />
        <h2 className="text-sm font-semibold">Reset data</h2>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Erase selected categories back to zero to start fresh. This does <span className="font-medium">not</span> touch your
        settings (company details, dropdown options, team members, integrations). This cannot be undone.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {NUMBERS.map((s) => <Row key={s.key} s={s} />)}
      </div>
      <div className="mt-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-400">Removes records, not just numbers</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {HEAVY.map((s) => <Row key={s.key} s={s} />)}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => setConfirming(true)}
          disabled={pending || sel.size === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-40"
        >
          <Trash2 size={15} /> Erase selected ({sel.size})
        </button>
        {res && (
          <span className={`inline-flex items-center gap-1 text-xs ${res.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
            {res.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {res.message}
          </span>
        )}
      </div>

      {confirming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !pending && setConfirming(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-rose-700">Erase {sel.size} categor{sel.size === 1 ? 'y' : 'ies'}?</h3>
            <p className="mt-1 text-sm text-slate-500">
              This permanently deletes: <span className="font-medium text-slate-700">{[...NUMBERS, ...HEAVY].filter((s) => sel.has(s.key)).map((s) => s.label).join(', ')}</span>.
              {selectedHeavy && ' Some of these remove records, not just numbers.'} Type <span className="font-mono font-semibold">ERASE</span> to confirm.
            </p>
            <input
              autoFocus
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="ERASE"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirming(false)} disabled={pending} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button
                onClick={run}
                disabled={pending || word.trim().toUpperCase() !== 'ERASE'}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-40"
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Erase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
