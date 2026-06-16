'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, CheckCircle2 } from 'lucide-react';
import ProgressBar from './ProgressBar';

type Opt = { value: string; label: string };

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

type Phase = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export default function DriveUploadForm({
  projectId,
  categories,
}: {
  projectId: string;
  categories: Opt[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState('OTHER');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const busy = phase === 'uploading' || phase === 'processing';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    setError('');

    const fd = new FormData();
    fd.set('projectId', projectId);
    fd.set('category', category);
    fd.set('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload-file');
    setPhase('uploading');
    setProgress(0);

    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const pct = (ev.loaded / ev.total) * 100;
      setProgress(pct);
      // Bytes are in the server's hands; it's now pushing to Drive.
      if (pct >= 100) setPhase('processing');
    };

    xhr.onload = () => {
      let res: any = null;
      try {
        res = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300 && res?.ok) {
        setPhase('done');
        setProgress(100);
        if (fileRef.current) fileRef.current.value = '';
        router.refresh();
        setTimeout(() => {
          setPhase('idle');
          setProgress(0);
        }, 1400);
      } else {
        setPhase('error');
        // Prefer the server's JSON error; otherwise show the HTTP status + a
        // snippet of the raw response so failures are diagnosable.
        const raw = (xhr.responseText || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
        setError(res?.error || `Upload failed (HTTP ${xhr.status || 0})${raw ? `: ${raw}` : ''}`);
      }
    };
    xhr.onerror = () => {
      setPhase('error');
      setError('Upload failed — network error.');
    };

    xhr.send(fd);
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <FileUp size={16} className="text-brand" /> Upload a file
      </h2>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Type</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={busy}
            className={inputCls}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">File</span>
          <input
            ref={fileRef}
            type="file"
            required
            disabled={busy}
            className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white disabled:opacity-50"
          />
        </label>

        {(busy || phase === 'done') && (
          <ProgressBar
            value={phase === 'processing' ? null : progress}
            label={
              phase === 'uploading'
                ? 'Uploading…'
                : phase === 'processing'
                  ? 'Saving to Drive…'
                  : 'Uploaded'
            }
          />
        )}

        {phase === 'done' && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle2 size={13} /> Saved to Drive.
          </p>
        )}
        {error && <p className="text-xs text-rose-600">{error}</p>}

        <button
          disabled={busy}
          className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? 'Uploading…' : 'Upload to Drive'}
        </button>
        <p className="text-xs text-slate-400">
          Saved to the Shared Drive under <span className="font-medium">Client - Project / Type</span>.
        </p>
      </div>
    </form>
  );
}
