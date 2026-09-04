'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FolderCog, FolderPlus, Loader2, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { createKeelDriveRoot, setDriveRoot } from '@/app/actions';

// Super-Admin control for where Keel stores files: a dedicated "Keel" folder or a
// Shared Drive, so they never mix with the connected account's personal files.
export default function DriveRootSetup({ dedicated, rootName, rootLink }: { dedicated: boolean; rootName: string | null; rootLink: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pasteId, setPasteId] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? 'Failed.' });
      if (r.ok) router.refresh();
    });

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${dedicated ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-center gap-2">
        <FolderCog size={16} className={dedicated ? 'text-brand' : 'text-amber-600'} />
        <h3 className="text-sm font-semibold text-slate-800">Storage location</h3>
      </div>

      {dedicated ? (
        <p className="mt-1 text-xs text-slate-600">
          Keel stores everything in <strong>{rootName ?? 'a dedicated folder'}</strong> — separate from your personal files.
          {rootLink && (
            <>{' '}<a href={rootLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-brand hover:underline">Open <ExternalLink size={11} /></a></>
          )}
        </p>
      ) : (
        <p className="mt-1 text-xs text-amber-800">
          Keel is using your Drive root, so its folders mix with your <strong>personal files</strong>. Give it a dedicated home:
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => run(createKeelDriveRoot, 'Created a “Keel” folder and moved existing client folders into it.')}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <FolderPlus size={13} />} {dedicated ? 'Create a new Keel folder' : 'Create a Keel folder'}
        </button>
        <span className="text-xs text-slate-400">or</span>
        <input
          value={pasteId}
          onChange={(e) => setPasteId(e.target.value)}
          placeholder="Paste a folder / Shared Drive ID"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-brand focus:outline-none"
        />
        <button
          onClick={() => run(() => setDriveRoot(pasteId), 'Storage location updated.')}
          disabled={pending || !pasteId.trim()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Use this
        </button>
      </div>

      {msg && (
        <p className={`mt-2 inline-flex items-center gap-1 text-xs ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
          {msg.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {msg.text}
        </p>
      )}
    </div>
  );
}
