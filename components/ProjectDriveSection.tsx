'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, FolderTree, Loader2, HardDrive } from 'lucide-react';
import { setupProjectDrive } from '@/app/actions';
import DriveBrowser from '@/components/DriveBrowser';

type Person = { id: string; name: string };

export default function ProjectDriveSection({
  projectId,
  driveFolderId,
  driveLink,
  people,
  canSetup,
}: {
  projectId: string;
  driveFolderId: string | null;
  driveLink: string | null;
  people: Person[];
  canSetup: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');

  if (driveFolderId) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold"><HardDrive size={16} className="text-brand" /> Project Drive folder</h2>
          {driveLink && (
            <a href={driveLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <ExternalLink size={13} /> Open in Drive
            </a>
          )}
        </div>
        <DriveBrowser people={people} canProvision={false} startFolder={{ id: driveFolderId, name: 'Project files' }} />
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <HardDrive size={24} className="mx-auto text-slate-300" />
      <p className="mt-2 text-sm font-medium text-slate-700">No Drive folder yet</p>
      {canSetup ? (
        <>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Create this project’s Drive folder tree (Client / Project / standard sub-folders).</p>
          <button
            onClick={() => start(async () => { setErr(''); const r = await setupProjectDrive(projectId); if (r.ok) router.refresh(); else setErr(r.error ?? 'Failed.'); })}
            disabled={pending}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-60"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <FolderTree size={15} />} Set up Drive folder
          </button>
          {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
        </>
      ) : (
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">An admin hasn’t set up this project’s Drive folder yet.</p>
      )}
    </section>
  );
}
