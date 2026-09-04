'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Folder, FileText, FileImage, FileSpreadsheet, FileType, ExternalLink, Loader2, RefreshCw, ChevronRight,
  HardDrive, AlertTriangle, UserPlus, FolderTree, Check, X, Upload, Pencil, Trash2, MessageSquare, Send,
} from 'lucide-react';
import {
  browseDrive, tagFileToUser, provisionAllDriveFolders, uploadDriveFile, renameDriveEntry, deleteDriveEntry,
  listDriveComments, addDriveComment,
} from '@/app/actions';
import type { DriveEntry } from '@/lib/drive';

type Crumb = { id: string | undefined; name: string };
type Person = { id: string; name: string };

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
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
function fmtDate(s: string | null) {
  if (!s) return '';
  try { return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(s)); } catch { return ''; }
}

export default function DriveBrowser({ people, canProvision, rootLabel = 'My Drive' }: { people: Person[]; canProvision: boolean; rootLabel?: string }) {
  const [path, setPath] = useState<Crumb[]>([{ id: undefined, name: rootLabel }]);
  const [files, setFiles] = useState<DriveEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [panel, setPanel] = useState<{ id: string; mode: 'tag' | 'comments' } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (folderId: string | undefined) => {
    setLoading(true); setError('');
    const r = await browseDrive(folderId);
    setLoading(false);
    if (r.ok) setFiles(r.files ?? []); else setError(r.error ?? 'Could not read Drive.');
  }, []);
  useEffect(() => { load(undefined); }, [load]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };
  const current = path[path.length - 1];
  const reload = () => load(current.id);

  const openFolder = (f: DriveEntry) => { setPath((p) => [...p, { id: f.id, name: f.name }]); setPanel(null); load(f.id); };
  const goTo = (i: number) => { const next = path.slice(0, i + 1); setPath(next); setPanel(null); load(next[next.length - 1].id); };

  const provision = async () => {
    setBusy(true);
    const r = await provisionAllDriveFolders();
    setBusy(false);
    flash(r.ok ? `Folders ready for ${r.clients} clients / ${r.projects} projects.` : r.error ?? 'Failed.');
    reload();
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !current.id) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('folderId', current.id);
    fd.append('file', file);
    const r = await uploadDriveFile(fd);
    setBusy(false);
    if (fileInput.current) fileInput.current.value = '';
    flash(r.ok ? `Uploaded ${file.name}.` : r.error ?? 'Upload failed.');
    if (r.ok) reload();
  };

  const doRename = async (id: string, name: string) => {
    setBusy(true);
    const r = await renameDriveEntry(id, name);
    setBusy(false);
    setRenaming(null);
    flash(r.ok ? 'Renamed.' : r.error ?? 'Rename failed.');
    if (r.ok) reload();
  };
  const doDelete = async (f: DriveEntry) => {
    if (!confirm(`Move “${f.name}” to Drive trash?`)) return;
    setBusy(true);
    const r = await deleteDriveEntry(f.id);
    setBusy(false);
    flash(r.ok ? 'Moved to trash.' : r.error ?? 'Delete failed.');
    if (r.ok) reload();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HardDrive size={16} className="text-brand" />
          <h3 className="text-sm font-semibold text-slate-800">Google Drive</h3>
        </div>
        <div className="flex items-center gap-2">
          {canProvision && (
            <button onClick={provision} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <FolderTree size={13} />} Create client/project folders
            </button>
          )}
          {current.id && (
            <>
              <input ref={fileInput} type="file" className="hidden" onChange={onUpload} />
              <button onClick={() => fileInput.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload
              </button>
            </>
          )}
          <button onClick={reload} disabled={loading} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-50" title="Refresh">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </button>
        </div>
      </div>

      {toast && <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">{toast}</div>}

      <div className="mt-2 flex flex-wrap items-center gap-0.5 text-xs text-slate-500">
        {path.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-0.5">
            {i > 0 && <ChevronRight size={12} className="text-slate-300" />}
            <button onClick={() => goTo(i)} className={`rounded px-1 py-0.5 hover:bg-slate-100 ${i === path.length - 1 ? 'font-medium text-slate-700' : ''}`}>{c.name}</button>
          </span>
        ))}
      </div>

      <div className="mt-2 max-h-[30rem] overflow-y-auto rounded-lg border border-slate-100">
        {error ? (
          <div className="flex items-center gap-2 px-3 py-6 text-sm text-rose-600"><AlertTriangle size={15} /> {error}</div>
        ) : loading && files.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-slate-400">Loading…</div>
        ) : files.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-slate-400">This folder is empty.</div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {files.map((f) => {
              const Icon = iconFor(f.mimeType);
              const isRenaming = renaming?.id === f.id;
              return (
                <li key={f.id}>
                  <div className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50">
                    <Icon size={16} className={f.isFolder ? 'text-amber-500' : 'text-slate-400'} />
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renaming!.name}
                        onChange={(e) => setRenaming({ id: f.id, name: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') doRename(f.id, renaming!.name); if (e.key === 'Escape') setRenaming(null); }}
                        className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-0.5 text-sm"
                      />
                    ) : f.isFolder ? (
                      <button onClick={() => openFolder(f)} className="min-w-0 flex-1 truncate text-left text-sm text-slate-700">{f.name}</button>
                    ) : f.webViewLink ? (
                      <a href={f.webViewLink} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-slate-700 hover:text-brand">{f.name}</a>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{f.name}</span>
                    )}
                    <span className="hidden shrink-0 text-[11px] text-slate-400 md:inline">{fmtDate(f.modifiedTime)}</span>
                    <span className="hidden w-14 shrink-0 text-right text-[11px] text-slate-400 sm:inline">{fmtSize(f.size)}</span>
                    <div className="flex shrink-0 items-center gap-1.5 text-slate-300">
                      {isRenaming ? (
                        <>
                          <button onClick={() => doRename(f.id, renaming!.name)} className="hover:text-emerald-600" title="Save"><Check size={14} /></button>
                          <button onClick={() => setRenaming(null)} className="hover:text-slate-600" title="Cancel"><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          {!f.isFolder && <button onClick={() => setPanel(panel?.id === f.id && panel.mode === 'comments' ? null : { id: f.id, mode: 'comments' })} className="hover:text-brand" title="Comments"><MessageSquare size={14} /></button>}
                          {!f.isFolder && <button onClick={() => setPanel(panel?.id === f.id && panel.mode === 'tag' ? null : { id: f.id, mode: 'tag' })} className="hover:text-brand" title="Tag a teammate"><UserPlus size={14} /></button>}
                          <button onClick={() => setRenaming({ id: f.id, name: f.name })} className="hover:text-slate-600" title="Rename"><Pencil size={13} /></button>
                          <button onClick={() => doDelete(f)} className="hover:text-rose-600" title="Delete"><Trash2 size={13} /></button>
                          {!f.isFolder && f.webViewLink && <a href={f.webViewLink} target="_blank" rel="noreferrer" className="hover:text-slate-600" title="Open in Drive"><ExternalLink size={13} /></a>}
                        </>
                      )}
                    </div>
                  </div>
                  {panel?.id === f.id && panel.mode === 'tag' && <TagRow file={f} people={people} onClose={() => setPanel(null)} onDone={flash} />}
                  {panel?.id === f.id && panel.mode === 'comments' && <CommentsPanel file={f} onDone={flash} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Tag a teammate (they get access + a notification), comment with @mentions, or manage files. You only see the projects you’re on.
      </p>
    </div>
  );
}

function TagRow({ file, people, onClose, onDone }: { file: DriveEntry; people: Person[]; onClose: () => void; onDone: (m: string) => void }) {
  const [userId, setUserId] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const submit = async () => {
    if (!userId) return;
    setPending(true);
    const r = await tagFileToUser(file.id, file.name, file.webViewLink, userId, note);
    setPending(false);
    if (r.ok) { onDone(`Tagged ${people.find((p) => p.id === userId)?.name ?? 'them'} on “${file.name}”.`); onClose(); }
    else onDone(r.error ?? 'Could not tag.');
  };
  return (
    <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-3 py-2">
      <select value={userId} onChange={(e) => setUserId(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
        <option value="">Tag who…</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" />
      <button onClick={submit} disabled={pending || !userId} className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50">
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Tag
      </button>
      <button onClick={onClose} className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:text-slate-700"><X size={13} /></button>
    </div>
  );
}

function CommentsPanel({ file, onDone }: { file: DriveEntry; onDone: (m: string) => void }) {
  const [comments, setComments] = useState<{ id: string; author: string; body: string; at: string }[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await listDriveComments(file.id);
    setLoading(false);
    if (r.ok) setComments(r.comments ?? []);
  }, [file.id]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!body.trim()) return;
    setPending(true);
    const r = await addDriveComment(file.id, file.name, body);
    setPending(false);
    if (r.ok) { setBody(''); load(); onDone('Comment added.'); }
    else onDone(r.error ?? 'Could not comment.');
  };

  return (
    <div className="bg-slate-50 px-3 py-2">
      {loading ? (
        <div className="py-2 text-center text-xs text-slate-400">Loading…</div>
      ) : comments.length === 0 ? (
        <div className="py-1 text-xs text-slate-400">No comments yet.</div>
      ) : (
        <ul className="mb-2 space-y-1.5">
          {comments.map((c) => (
            <li key={c.id} className="text-xs">
              <span className="font-medium text-slate-700">{c.author}</span>{' '}
              <span className="text-slate-400">{fmtDate(c.at)}</span>
              <div className="text-slate-600">{c.body}</div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="Comment… use @name to notify" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" />
        <button onClick={submit} disabled={pending || !body.trim()} className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50">
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        </button>
      </div>
    </div>
  );
}
