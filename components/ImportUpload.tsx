'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileSpreadsheet, Loader2, Landmark, CreditCard } from 'lucide-react';
import { createPendingImport } from '@/app/actions';
import {
  fileToBase64, parseCsv, detectHeaderIndex, detectMapping, normalizeDate, num, toLines, type ImportLine,
} from '@/lib/statement-parse';
import ProgressBar from './ProgressBar';

type Opt = { value: string; label: string };
type Rule = { matchKey: string; type: string; category: string; title: string | null };

export default function ImportUpload({ currencies, rules = [] }: { currencies: Opt[]; rules?: Rule[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<'BANK' | 'CREDIT_CARD'>('BANK');

  const rulesByKey = new Map<string, { type: string; category: string; title: string | null }>();
  for (const r of rules) rulesByKey.set(r.matchKey, r);

  const parsePdf = async (f: File): Promise<{ lines: ImportLine[]; currency: string; base64: string } | null> => {
    const dataUrl = await fileToBase64(f);
    const r = await fetch('/api/parse-statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: dataUrl }),
    });
    const res = await r.json().catch(() => null);
    if (!res?.ok || !Array.isArray(res.transactions)) {
      setError(res?.error === 'not_configured' ? 'Reading PDFs needs OPENROUTER_API_KEY set in Railway.' : res?.error === 'no_text' ? `${f.name}: scanned image PDF with no text.` : `Couldn't read ${f.name}.`);
      return null;
    }
    const raw = res.transactions.map((t: any) => ({
      date: t.date || '',
      desc: t.description || '',
      outflow: t.direction === 'credit' ? 0 : Number(t.amount) || 0,
      inflow: t.direction === 'credit' ? Number(t.amount) || 0 : 0,
      category: t.category || 'OTHER',
    }));
    const currency = typeof res.currency === 'string' && currencies.some((c) => c.value === res.currency) ? res.currency : 'CAD';
    return { lines: toLines(raw, rulesByKey), currency, base64: dataUrl };
  };

  const parseCsvFile = async (f: File): Promise<{ lines: ImportLine[]; currency: string; base64: string } | null> => {
    const text = await f.text();
    const all = parseCsv(text);
    const headerIdx = detectHeaderIndex(all);
    const rows = headerIdx > 0 ? all.slice(headerIdx) : all;
    const mapping = detectMapping(rows[0] ?? []);
    const dataRows = rows.slice(1);
    const raw = dataRows.map((cols) => {
      let outflow = 0;
      let inflow = 0;
      if (mapping.mode === 'split') {
        outflow = Math.abs(num(cols[mapping.debit] ?? ''));
        inflow = Math.abs(num(cols[mapping.credit] ?? ''));
      } else {
        const v = num(cols[mapping.amount] ?? '');
        if (mapping.expenseSign === 'neg') { if (v < 0) outflow = -v; else inflow = v; }
        else if (v > 0) outflow = v; else inflow = -v;
      }
      return { date: normalizeDate(cols[mapping.date] ?? '', mapping.dateOrder), desc: (cols[mapping.desc] ?? '').trim(), outflow, inflow, category: undefined as string | undefined };
    });
    const base64 = await fileToBase64(f);
    return { lines: toLines(raw, rulesByKey), currency: 'CAD', base64 };
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (list.length === 0) return;
    setError(null);
    setBusy(true);
    setProgress({ done: 0, total: list.length });
    try {
      for (const f of list) {
        const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
        const parsed = isPdf ? await parsePdf(f) : await parseCsvFile(f);
        if (parsed) {
          await createPendingImport({
            fileName: f.name,
            mimeType: f.type || (isPdf ? 'application/pdf' : 'text/csv'),
            fileBase64: parsed.base64,
            accountType: type,
            accountLabel: f.name.replace(/\.[^.]+$/, ''),
            currency: parsed.currency,
            lines: parsed.lines,
          });
        }
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
      router.refresh();
    } catch {
      setError('Upload failed — try again.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  if (busy) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-light text-brand"><Loader2 size={24} className="animate-spin" /></span>
        <h2 className="mt-4 text-sm font-semibold">
          {progress && progress.total > 1 ? `Reading statement ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : 'Reading your statement…'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">Parsing the transactions and saving as pending imports you can review.</p>
        <ProgressBar label="Analyzing…" className="mx-auto mt-4 max-w-xs" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-light text-brand"><UploadCloud size={24} /></span>
      <h2 className="mt-4 text-sm font-semibold">Upload statements (CSV or PDF)</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        Choose what you're uploading, then pick one or several files. Each becomes a{' '}
        <span className="font-medium text-slate-600">pending import</span> you can review and finish whenever.
      </p>

      {/* What am I uploading? */}
      <div className="mt-4 inline-flex rounded-xl border border-slate-200 p-1">
        {([['BANK', 'Bank account', Landmark], ['CREDIT_CARD', 'Credit card', CreditCard]] as const).map(([val, label, Icon]) => (
          <button
            key={val}
            onClick={() => setType(val)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              type === val ? 'bg-brand text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark">
          <FileSpreadsheet size={16} /> Choose {type === 'CREDIT_CARD' ? 'credit card' : 'bank'} statements
          <input type="file" multiple accept=".csv,text/csv,.pdf,application/pdf" className="hidden" onChange={onFile} />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
