'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UploadCloud, FileSpreadsheet, CheckCircle2, RotateCcw, Loader2, Eye } from 'lucide-react';
import { importStatementExpenses } from '@/app/actions';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type Opt = { value: string; label: string };

const miniCls =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none';

// ── CSV / parsing helpers ────────────────────────────────────────────────────

function pickDelim(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const counts: Record<string, number> = {
    ',': (line.match(/,/g) ?? []).length,
    ';': (line.match(/;/g) ?? []).length,
    '\t': (line.match(/\t/g) ?? []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ',';
}

function parseCsv(text: string): string[][] {
  const delim = pickDelim(text);
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

function num(s: string): number {
  if (!s) return 0;
  let t = s.trim();
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (/-\s*$/.test(t)) neg = true; // trailing minus
  t = t.replace(/[^0-9.-]/g, '');
  const v = parseFloat(t);
  if (Number.isNaN(v)) return 0;
  return neg ? -Math.abs(v) : v;
}

function normalizeDate(s: string, order: 'MDY' | 'DMY'): string {
  const t = (s ?? '').trim();
  if (!t) return '';
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = `20${y}`;
    const mm = order === 'MDY' ? a : b;
    const dd = order === 'MDY' ? b : a;
    return `${y}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

// Description keyword → expense category. First match wins, so order matters
// (interest is checked first because it also renames the line).
const CAT_RULES: [RegExp, string][] = [
  [/interest/i, 'FEES'],
  [/\b(fee|charge|nsf|overdraft|service charge|atm|annual fee|late fee|finance charge)\b/i, 'FEES'],
  [/(\bgst\b|\bhst\b|\bqst\b|\bpst\b|\bvat\b|\btax\b|cra|revenue agency|irs)/i, 'TAXES'],
  [/(netflix|spotify|youtube|prime|disney|patreon|substack|subscription|membership|icloud|dropbox|1password|google one)/i, 'SUBSCRIPTION'],
  [/(aws|amazon web|google ?cloud|gcp|openai|anthropic|adobe|figma|notion|slack|microsoft|office ?365|github|gitlab|jetbrains|cursor|zoom|canva|airtable|zapier|atlassian|jira)/i, 'SOFTWARE'],
  [/(vercel|netlify|railway|heroku|digitalocean|cloudflare|hosting|domain|namecheap|godaddy|porkbun|squarespace|wix|wordpress|hostgator|bluehost)/i, 'HOSTING'],
  [/(hydro|electric|gas bill|water|internet|broadband|fibre|fiber|telus|bell|rogers|verizon|at&t|comcast|phone bill|mobile|wireless|utility|utilities)/i, 'UTILITIES'],
  [/(facebook|meta|google ads|adwords|linkedin|tiktok|twitter|\bads\b|marketing|mailchimp|hubspot|sendgrid|klaviyo|seo)/i, 'MARKETING'],
  [/(uber|lyft|taxi|airline|air canada|westjet|delta|united|flight|hotel|airbnb|expedia|booking\.com|rental car|train|via rail|parking|gas station|petro|shell|esso)/i, 'TRAVEL'],
  [/(restaurant|cafe|coffee|starbucks|tim hortons|mcdonald|uber eats|doordash|skip the dishes|grubhub|dining|bar &|catering|lunch|dinner)/i, 'MEALS'],
  [/(staples|office|wework|regus|rent|supplies|stationery)/i, 'OFFICE'],
  [/(upwork|fiverr|contractor|payroll|deel|gusto|freelanc|consult)/i, 'CONTRACTOR'],
  [/(apple store|best buy|equipment|hardware|laptop|monitor|keyboard|dell|lenovo|printer)/i, 'EQUIPMENT'],
];
function guessCategory(desc: string): string {
  for (const [re, cat] of CAT_RULES) if (re.test(desc)) return cat;
  return 'OTHER';
}

// Some bank CSVs prepend account/title rows before the real header. Find the
// first row that looks like a column header so detection lines up.
function detectHeaderIndex(rows: string[][]): number {
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const cells = rows[i].map((c) => c.toLowerCase());
    const hasDate = cells.some((c) => /date|posted/.test(c));
    const hasMoney = cells.some((c) => /amount|debit|credit|withdraw|deposit|value/.test(c));
    const hasDesc = cells.some((c) => /desc|narrat|detail|memo|payee|name|merchant|particular|transaction/.test(c));
    if (hasDate && (hasMoney || hasDesc)) return i;
  }
  return 0;
}

type Mapping = {
  date: number;
  desc: number;
  mode: 'signed' | 'split';
  amount: number;
  debit: number;
  credit: number;
  expenseSign: 'neg' | 'pos';
  dateOrder: 'MDY' | 'DMY';
};

function findCol(header: string[], re: RegExp, fallback = -1): number {
  const i = header.findIndex((h) => re.test(h));
  return i >= 0 ? i : fallback;
}

function detectMapping(header: string[]): Mapping {
  const date = findCol(header, /date|posted/i, 0);
  const debit = findCol(header, /debit|withdraw|money out|paid out|charge/i);
  const credit = findCol(header, /credit|deposit|money in|paid in/i);
  const amount = findCol(header, /amount|value/i, header.length - 1);
  const desc = findCol(header, /desc|narrat|detail|memo|payee|name|merchant|particular/i, 1);
  const mode: Mapping['mode'] = debit >= 0 ? 'split' : 'signed';
  return {
    date: date < 0 ? 0 : date,
    desc: desc < 0 ? 1 : desc,
    mode,
    amount: amount < 0 ? header.length - 1 : amount,
    debit: debit < 0 ? 0 : debit,
    credit: credit < 0 ? 0 : credit,
    expenseSign: 'neg',
    dateOrder: 'MDY',
  };
}

// ── Component ────────────────────────────────────────────────────────────────

type Override = { include?: boolean; title?: string; category?: string; date?: string; amount?: string };

export default function StatementImport({ currencies, categories }: { currencies: Opt[]; categories: Opt[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<'csv' | 'pdf' | null>(null);
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [pdfRows, setPdfRows] = useState<{ date: string; desc: string; outflow: number; inflow: number; category: string }[] | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const [currency, setCurrency] = useState('CAD');
  const [note, setNote] = useState('');
  const [overrides, setOverrides] = useState<Record<number, Override>>({});
  const [result, setResult] = useState<number | null>(null);
  const [pending, start] = useTransition();
  // Preview of the original file (PDF data URL / raw CSV text). Temporary trust
  // aid — safe to remove this + the panel below once no longer needed.
  const [sourceData, setSourceData] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    setFileName(f.name);
    setOverrides({});
    setResult(null);
    setPdfNotice(null);

    if (isPdf) {
      setMode('pdf');
      setRawRows([]);
      setMapping(null);
      setPdfRows(null);
      setPdfLoading(true);
      try {
        const dataUrl = await fileToBase64(f);
        setSourceData(dataUrl);
        const r = await fetch('/api/parse-statement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdf: dataUrl }),
        });
        const res = await r.json();
        if (res?.ok && Array.isArray(res.transactions)) {
          if (res.currency && currencies.some((c) => c.value === res.currency)) setCurrency(res.currency);
          setPdfRows(
            res.transactions.map((t: any) => ({
              date: t.date || '',
              desc: t.description || '',
              outflow: t.direction === 'credit' ? 0 : Number(t.amount) || 0,
              inflow: t.direction === 'credit' ? Number(t.amount) || 0 : 0,
              category: t.category || 'OTHER',
            })),
          );
          if (!res.transactions.length) setPdfNotice('No transactions were found in this PDF.');
        } else if (res?.error === 'not_configured') {
          setPdfNotice('Reading PDFs needs OPENROUTER_API_KEY set in Railway. You can upload a CSV in the meantime.');
        } else if (res?.error === 'no_text') {
          setPdfNotice('This looks like a scanned image PDF (no selectable text). Try your bank’s CSV export, or a text PDF.');
        } else {
          setPdfNotice(`Couldn’t read the PDF${res?.detail ? ` (${res.detail})` : ''}. Try a CSV export instead.`);
        }
      } catch {
        setPdfNotice('PDF read failed. Try again, or use a CSV export.');
      } finally {
        setPdfLoading(false);
      }
      return;
    }

    const text = await f.text();
    setSourceData(text);
    const all = parseCsv(text);
    const headerIdx = detectHeaderIndex(all);
    const rows = headerIdx > 0 ? all.slice(headerIdx) : all;
    setMode('csv');
    setPdfRows(null);
    setRawRows(rows);
    setHasHeader(true);
    setMapping(detectMapping(rows[0] ?? []));
  };

  const reset = () => {
    setMode(null);
    setRawRows([]);
    setMapping(null);
    setPdfRows(null);
    setPdfNotice(null);
    setPdfLoading(false);
    setFileName('');
    setOverrides({});
    setResult(null);
    setSourceData('');
    setShowPreview(false);
  };

  const header = useMemo(() => {
    if (mode !== 'csv' || !rawRows.length) return [];
    return hasHeader ? rawRows[0] : rawRows[0].map((_, i) => `Column ${i + 1}`);
  }, [mode, rawRows, hasHeader]);

  const columnOpts = header.map((h, i) => ({ value: i, label: h?.trim() || `Column ${i + 1}` }));

  // Normalized rows from either CSV (mapping) or PDF (model); the review layer
  // (interest rename, category guess, edits) sits on top of this.
  const base = useMemo(() => {
    if (mode === 'pdf') {
      return (pdfRows ?? []).map((r) => ({
        date: r.date, desc: r.desc, outflow: r.outflow, inflow: r.inflow, category: r.category as string | undefined,
      }));
    }
    if (mode === 'csv' && mapping) {
      const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
      return dataRows.map((cols) => {
        const desc = (cols[mapping.desc] ?? '').trim();
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
        return { date: normalizeDate(cols[mapping.date] ?? '', mapping.dateOrder), desc, outflow, inflow, category: undefined as string | undefined };
      });
    }
    return [];
  }, [mode, pdfRows, rawRows, hasHeader, mapping]);

  const txns = useMemo(
    () =>
      base.map((b, i) => {
        const isExpense = b.outflow > 0;
        const interest = /interest/i.test(b.desc);
        const defTitle = interest ? 'Additional credit card fee' : b.desc || 'Expense';
        const defCat = interest ? 'FEES' : b.category || guessCategory(b.desc);
        const o = overrides[i] ?? {};
        const baseAmt = b.outflow || b.inflow;
        return {
          i,
          rawDesc: b.desc,
          isExpense,
          interest,
          include: o.include ?? isExpense,
          title: o.title ?? defTitle,
          category: o.category ?? defCat,
          date: o.date ?? b.date,
          amount: o.amount ?? (baseAmt ? baseAmt.toFixed(2) : '0'),
        };
      }),
    [base, overrides],
  );

  const included = txns.filter((t) => t.include && Number(t.amount) > 0);
  const includedTotal = included.reduce((s, t) => s + Number(t.amount), 0);

  const setOv = (i: number, patch: Override) =>
    setOverrides((p) => ({ ...p, [i]: { ...p[i], ...patch } }));

  const setMap = (patch: Partial<Mapping>) => setMapping((m) => (m ? { ...m, ...patch } : m));

  const doImport = () => {
    const items = included.map((t) => ({
      title: t.title,
      category: t.category,
      amount: t.amount,
      currency,
      date: t.date,
      note: note.trim() || 'Imported from statement',
    }));
    start(async () => {
      const res = await importStatementExpenses(items);
      setResult(res.count);
      router.refresh();
    });
  };

  // ── Success state ──
  if (result !== null) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={24} />
        </span>
        <h2 className="mt-4 text-base font-semibold text-emerald-900">
          Imported {result} expense{result === 1 ? '' : 's'}
        </h2>
        <p className="mt-1 text-sm text-emerald-700">They’ve been added to your expenses, converted to CAD.</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link href="/finance?tab=expenses" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">
            View expenses
          </Link>
          <button onClick={reset} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-white">
            Import another
          </button>
        </div>
      </div>
    );
  }

  // ── No file chosen yet ──
  if (!mode) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-light text-brand">
          <UploadCloud size={24} />
        </span>
        <h2 className="mt-4 text-sm font-semibold">Upload a statement (CSV or PDF)</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          Drop your bank or credit-card statement here. CSVs are mapped automatically; PDFs are read for you.
          You’ll review every line before anything is added, and “interest” lines become “Additional credit card fee”.
        </p>
        <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark">
          <FileSpreadsheet size={16} /> Choose CSV or PDF
          <input type="file" accept=".csv,text/csv,.pdf,application/pdf" className="hidden" onChange={onFile} />
        </label>
      </div>
    );
  }

  // ── PDF being read ──
  if (mode === 'pdf' && pdfLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-light text-brand">
          <Loader2 size={24} className="animate-spin" />
        </span>
        <h2 className="mt-4 text-sm font-semibold">Reading {fileName}…</h2>
        <p className="mt-1 text-sm text-slate-500">Extracting and structuring the transactions — this can take a few seconds.</p>
      </div>
    );
  }

  // ── PDF read but nothing usable ──
  if (mode === 'pdf' && (!pdfRows || pdfRows.length === 0)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <h2 className="text-sm font-semibold text-amber-900">Couldn’t pull transactions from this PDF</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-amber-800">{pdfNotice ?? 'No transactions were found.'}</p>
        <button onClick={reset} className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          Try another file
        </button>
      </div>
    );
  }

  // ── Mapping + review ──
  return (
    <div className="space-y-6">
      {/* Source controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileSpreadsheet size={16} className="text-brand" /> {fileName}
            <span className="text-xs font-normal text-slate-400">
              · {mode === 'csv' ? `${hasHeader ? rawRows.length - 1 : rawRows.length} rows` : `${txns.length} transactions`}
            </span>
          </h2>
          <div className="flex items-center gap-3">
            {sourceData && (
              <button onClick={() => setShowPreview((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand">
                <Eye size={13} /> {showPreview ? 'Hide original' : 'Preview original'}
              </button>
            )}
            <button onClick={reset} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800">
              <RotateCcw size={13} /> Choose a different file
            </button>
          </div>
        </div>

        {mode === 'csv' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Date column</span>
            <select className={miniCls} value={mapping!.date} onChange={(e) => setMap({ date: Number(e.target.value) })}>
              {columnOpts.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Description column</span>
            <select className={miniCls} value={mapping!.desc} onChange={(e) => setMap({ desc: Number(e.target.value) })}>
              {columnOpts.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Amount layout</span>
            <select className={miniCls} value={mapping!.mode} onChange={(e) => setMap({ mode: e.target.value as Mapping['mode'] })}>
              <option value="signed">Single amount column</option>
              <option value="split">Separate debit / credit</option>
            </select>
          </label>

          {mapping!.mode === 'signed' ? (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Amount column</span>
                <select className={miniCls} value={mapping!.amount} onChange={(e) => setMap({ amount: Number(e.target.value) })}>
                  {columnOpts.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Expenses are…</span>
                <select className={miniCls} value={mapping!.expenseSign} onChange={(e) => setMap({ expenseSign: e.target.value as 'neg' | 'pos' })}>
                  <option value="neg">Negative amounts</option>
                  <option value="pos">Positive amounts</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Debit (out) column</span>
                <select className={miniCls} value={mapping!.debit} onChange={(e) => setMap({ debit: Number(e.target.value) })}>
                  {columnOpts.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Credit (in) column</span>
                <select className={miniCls} value={mapping!.credit} onChange={(e) => setMap({ credit: Number(e.target.value) })}>
                  {columnOpts.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
            </>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Date format</span>
            <select className={miniCls} value={mapping!.dateOrder} onChange={(e) => setMap({ dateOrder: e.target.value as 'MDY' | 'DMY' })}>
              <option value="MDY">MM / DD / YYYY</option>
              <option value="DMY">DD / MM / YYYY</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Statement currency</span>
            <select className={miniCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Note on each expense</span>
            <input className={miniCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Visa ••1234 — June" />
          </label>
          <label className="flex items-end gap-2 pb-1.5 text-sm text-slate-600">
            <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} className="rounded border-slate-300" />
            First row is a header
          </label>
        </div>
        )}

        {mode === 'pdf' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Statement currency</span>
              <select className={miniCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {currencies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Note on each expense</span>
              <input className={miniCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Visa ••1234 — June" />
            </label>
            <div className="flex items-end pb-1.5 text-xs text-slate-400">Read automatically from the PDF — review every line below.</div>
          </div>
        )}
      </div>

      {pdfNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">{pdfNotice}</div>
      )}

      {/* Original-file preview (temporary trust aid) */}
      {showPreview && sourceData && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Eye size={15} className="text-slate-400" /> Original file</h2>
            <button onClick={() => setShowPreview(false)} className="text-xs font-medium text-slate-500 hover:text-slate-800">Hide</button>
          </div>
          {mode === 'pdf' ? (
            <iframe title="Statement preview" src={sourceData} className="h-[70vh] w-full bg-slate-50" />
          ) : (
            <pre className="max-h-[480px] overflow-auto whitespace-pre bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
              {sourceData.slice(0, 20000)}
            </pre>
          )}
        </div>
      )}

      {/* Review table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold">Review &amp; edit</h2>
          <span className="text-xs text-slate-400">{included.length} selected · {includedTotal.toLocaleString('en-US', { style: 'currency', currency })}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <input
                    type="checkbox"
                    checked={included.length > 0 && included.length === txns.filter((t) => Number(t.amount) > 0).length}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setOverrides((p) => {
                        const next = { ...p };
                        txns.forEach((t) => { next[t.i] = { ...next[t.i], include: on }; });
                        return next;
                      });
                    }}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txns.map((t) => (
                <tr key={t.i} className={`${t.include ? '' : 'opacity-50'} hover:bg-slate-50`}>
                  <td className="px-4 py-2">
                    <input type="checkbox" checked={t.include} onChange={(e) => setOv(t.i, { include: e.target.checked })} className="rounded border-slate-300" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="date" value={t.date} onChange={(e) => setOv(t.i, { date: e.target.value })} className={`${miniCls} w-36`} />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={t.title}
                      onChange={(e) => setOv(t.i, { title: e.target.value })}
                      className={`${miniCls} min-w-[200px]`}
                    />
                    {t.interest && <span className="mt-1 block text-[11px] text-amber-600">renamed from interest</span>}
                  </td>
                  <td className="px-4 py-2">
                    <select value={t.category} onChange={(e) => setOv(t.i, { category: e.target.value })} className={`${miniCls} w-36`}>
                      {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={t.amount}
                      onChange={(e) => setOv(t.i, { amount: e.target.value })}
                      className={`${miniCls} w-28 text-right tabular-nums`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import bar */}
      <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur">
        <p className="text-sm text-slate-500">
          {included.length} expense{included.length === 1 ? '' : 's'} ready ·{' '}
          <span className="font-medium text-slate-700">{includedTotal.toLocaleString('en-US', { style: 'currency', currency })}</span>
        </p>
        <button
          onClick={doImport}
          disabled={pending || included.length === 0}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? 'Importing…' : `Import ${included.length} expense${included.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
