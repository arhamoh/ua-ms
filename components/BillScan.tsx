'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, ImageUp, Loader2, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { importStatementExpenses } from '@/app/actions';
import ProgressBar from './ProgressBar';

type Opt = { value: string; label: string };

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

// Downscale to keep the upload small/fast and cheap to OCR.
function fileToDataUrl(file: File, maxDim = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no canvas'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type Fields = { title: string; amount: string; currency: string; date: string; category: string; note: string };

export default function BillScan({ currencies, categories }: { currencies: Opt[]; categories: Opt[] }) {
  const router = useRouter();
  const [preview, setPreview] = useState('');
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [fields, setFields] = useState<Fields | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const hasCurrency = (c: string) => currencies.some((x) => x.value === c);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setNotice(null);
    setResult(null);
    setScanned(false);
    let dataUrl = '';
    try {
      dataUrl = await fileToDataUrl(f);
    } catch {
      setNotice('Could not read that image. Try another photo.');
      return;
    }
    setPreview(dataUrl);
    // Start with empty fields so manual entry is always possible.
    setFields({ title: '', amount: '', currency: hasCurrency('PKR') ? 'PKR' : 'CAD', date: today, category: 'OTHER', note: '' });
    scan(dataUrl);
  };

  const scan = (dataUrl: string) => {
    setScanning(true);
    fetch('/api/scan-bill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok && res.data) {
          const d = res.data;
          setFields({
            title: d.summary || d.vendor || '',
            amount: d.amount ? String(d.amount) : '',
            currency: hasCurrency(d.currency) ? d.currency : hasCurrency('PKR') ? 'PKR' : 'CAD',
            date: d.date || today,
            category: d.category || 'OTHER',
            note: d.vendor ? `Bill — ${d.vendor}` : 'Scanned bill',
          });
          setScanned(true);
        } else if (res?.error === 'not_configured') {
          setNotice('Bill scanning needs OPENROUTER_API_KEY set in Railway. You can still type the bill in manually below.');
        } else {
          setNotice(`Couldn’t read the bill automatically${res?.detail ? ` (${res.detail})` : ''}. Enter the details manually below.`);
        }
      })
      .catch(() => setNotice('Scan failed. Enter the details manually below.'))
      .finally(() => setScanning(false));
  };

  const set = (patch: Partial<Fields>) => setFields((f) => (f ? { ...f, ...patch } : f));

  const reset = () => {
    setPreview('');
    setFields(null);
    setScanned(false);
    setNotice(null);
    setResult(null);
  };

  const save = () => {
    if (!fields) return;
    start(async () => {
      const res = await importStatementExpenses([
        {
          title: fields.title || 'Bill',
          category: fields.category,
          amount: fields.amount,
          currency: fields.currency,
          date: fields.date,
          note: fields.note.trim() || 'Scanned bill',
        },
      ]);
      setResult(res.count);
      router.refresh();
    });
  };

  // Success
  if (result !== null) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={24} />
        </span>
        <h2 className="mt-4 text-base font-semibold text-emerald-900">
          {result === 1 ? 'Bill added to expenses' : 'Added'}
        </h2>
        <p className="mt-1 text-sm text-emerald-700">Converted to CAD and saved to your expenses.</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link href="/finance?tab=expenses" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">
            View expenses
          </Link>
          <button onClick={reset} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-white">
            Scan another
          </button>
        </div>
      </div>
    );
  }

  // Empty: capture / upload
  if (!preview) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-light text-brand">
          <Sparkles size={24} />
        </span>
        <h2 className="mt-4 text-sm font-semibold">Scan a bill or receipt</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          Take a photo or upload an image of a bill (any country / currency). It’s read automatically —
          vendor, total and date — converted to CAD, and added to expenses after you confirm.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark">
            <Camera size={16} /> Take a photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            <ImageUp size={16} /> Upload image
            <input type="file" accept="image/*" className="hidden" onChange={onPick} />
          </label>
        </div>
      </div>
    );
  }

  // Review
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Bill preview" className="max-h-[460px] w-full object-contain" />
        </div>
        <button onClick={reset} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800">
          <RotateCcw size={13} /> Use a different photo
        </button>
      </div>

      <div className="lg:col-span-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            {scanning ? (
              <>
                <Loader2 size={16} className="animate-spin text-brand" /> Reading the bill…
              </>
            ) : (
              <>
                <Sparkles size={16} className="text-brand" /> {scanned ? 'Detected — please confirm' : 'Enter the details'}
              </>
            )}
          </div>

          {scanning && (
            <ProgressBar label="Reading the photo — this can take a few seconds…" className="mb-4" />
          )}

          {notice && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</div>
          )}

          {fields && (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">What is it *</span>
                <input value={fields.title} onChange={(e) => set({ title: e.target.value })} className={inputCls} placeholder="e.g. Electricity bill" />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="col-span-2 block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Amount *</span>
                  <input value={fields.amount} onChange={(e) => set({ amount: e.target.value })} type="number" min="0" step="any" className={inputCls} placeholder="0" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Currency</span>
                  <select value={fields.currency} onChange={(e) => set({ currency: e.target.value })} className={inputCls}>
                    {currencies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Date</span>
                  <input value={fields.date} onChange={(e) => set({ date: e.target.value })} type="date" className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Category</span>
                  <select value={fields.category} onChange={(e) => set({ category: e.target.value })} className={inputCls}>
                    {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Note</span>
                <input value={fields.note} onChange={(e) => set({ note: e.target.value })} className={inputCls} placeholder="Bill — vendor" />
              </label>

              <button
                onClick={save}
                disabled={pending || scanning || !fields.amount || Number(fields.amount) <= 0}
                className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50"
              >
                {pending ? 'Adding…' : 'Add to expenses'}
              </button>
              <p className="text-center text-xs text-slate-400">Saved in CAD at today’s exchange rate.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
