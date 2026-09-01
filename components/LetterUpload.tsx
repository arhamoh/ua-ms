'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, Loader2, FileText } from 'lucide-react';

const ERRORS: Record<string, string> = {
  too_large: 'That file is too large (max 15 MB).',
  no_file: 'Please choose a file.',
  forbidden: 'Only super admins can upload documents.',
  unsupported: 'Upload a PDF or an image.',
};

export default function LetterUpload() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError(null);
    setName(f.name);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('file', f);
      const r = await fetch('/api/letters', { method: 'POST', body: fd });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.id) {
        setError(ERRORS[data?.error] ?? 'Upload failed — try again.');
        setBusy(false);
        return;
      }
      router.push(`/letters/${data.id}`);
    } catch {
      setError('Upload failed — try again.');
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-light text-brand">
          <Loader2 size={24} className="animate-spin" />
        </span>
        <h2 className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold">
          <FileText size={15} className="text-slate-400" /> Analyzing {name}…
        </h2>
        <p className="mt-1 text-sm text-slate-500">Reading, translating if needed, and pulling out the required actions. This can take a moment.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-light text-brand">
        <UploadCloud size={24} />
      </span>
      <h2 className="mt-4 text-sm font-semibold">Upload a letter or document</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        PDF or image. The AI reads it, translates French → English, summarizes it, and turns the required actions into a
        board of tasks you can work through.
      </p>
      <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark">
        <UploadCloud size={16} /> Choose a file
        <input type="file" accept=".pdf,application/pdf,image/*" className="hidden" onChange={onFile} />
      </label>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
