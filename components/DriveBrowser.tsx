'use client';

import { useEffect, useState, useCallback } from 'react';
import { Folder, FileText, FileImage, FileSpreadsheet, FileType, ExternalLink, Loader2, RefreshCw, ChevronRight, HardDrive, AlertTriangle } from 'lucide-react';
import { browseDrive } from '@/app/actions';
import type { DriveEntry } from '@/lib/drive';

type Crumb = { id: string | undefined; name: string };

function iconFor(m: string) {
  if (m.includes('folder')) return Folder;
  if (m.includes('image')) return FileImage;
  if (m.includes('spreadsheet') || m.includes('excel') || m.includes('csv')) return FileSpreadsheet;
  if (m.includes('pdf')) return FileType;
  return FileText;
}
function fmtSize(n: number | null) {
  if (!n) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
function fmtDate(s: string | null) {
  if (!s) return '';
  try { return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(s)); } catch { return ''; }
}

export default function DriveBrowser() {
  const [path, setPath] = useState<Crumb[]>([{ id: undefined, name: 'My Drive' }]);
  const [files, setFiles] = useState<DriveEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (folderId: string | undefined) => {
    setLoading(true);
    setError('');
    const r = await browseDrive(folderId);
    setLoading(false);
    if (r.ok) setFiles(r.files ?? []);
    else setError(r.error ?? 'Could not read Drive.');
  }, []);

  useEffect(() => {
    load(undefined);
  }, [load]);

  const openFolder = (f: DriveEntry) => {
    setPath((p) => [...p, { id: f.id, name: f.name }]);
    load(f.id);
  };
  const goTo = (i: number) => {
    const next = path.slice(0, i + 1);
    setPath(next);
    load(next[next.length - 1].id);
  };

  const current = path[path.length - 1];

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HardDrive size={16} className="text-brand" />
          <h3 className="text-sm font-semibold text-slate-800">Browse Google Drive</h3>
        </div>
        <button onClick={() => load(current.id)} disabled={loading} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-50" title="Refresh">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
      </div>

      {/* Breadcrumbs */}
      <div className="mt-2 flex flex-wrap items-center gap-0.5 text-xs text-slate-500">
        {path.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-0.5">
            {i > 0 && <ChevronRight size={12} className="text-slate-300" />}
            <button onClick={() => goTo(i)} className={`rounded px-1 py-0.5 hover:bg-slate-100 ${i === path.length - 1 ? 'font-medium text-slate-700' : ''}`}>
              {c.name}
            </button>
          </span>
        ))}
      </div>

      <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-100">
        {error ? (
          <div className="flex items-center gap-2 px-3 py-6 text-sm text-rose-600">
            <AlertTriangle size={15} /> {error}
          </div>
        ) : loading && files.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-slate-400">Loading…</div>
        ) : files.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-slate-400">This folder is empty.</div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {files.map((f) => {
              const Icon = iconFor(f.mimeType);
              const row = (
                <div className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50">
                  <Icon size={16} className={f.isFolder ? 'text-amber-500' : 'text-slate-400'} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{f.name}</span>
                  <span className="hidden shrink-0 text-[11px] text-slate-400 sm:inline">{fmtDate(f.modifiedTime)}</span>
                  <span className="w-14 shrink-0 text-right text-[11px] text-slate-400">{fmtSize(f.size)}</span>
                  {!f.isFolder && f.webViewLink && <ExternalLink size={13} className="shrink-0 text-slate-300" />}
                </div>
              );
              return (
                <li key={f.id}>
                  {f.isFolder ? (
                    <button onClick={() => openFolder(f)} className="w-full text-left">{row}</button>
                  ) : f.webViewLink ? (
                    <a href={f.webViewLink} target="_blank" rel="noreferrer">{row}</a>
                  ) : (
                    <div>{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Reading live from the connected Google account. Click a folder to open it, or a file to view it in Drive.
      </p>
    </div>
  );
}
