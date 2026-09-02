'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck, Loader2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { commitAllPendingImports } from '@/app/actions';

// Commits every pending import at once, using each one's reviewed lines.
export default function CommitAllButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = () =>
    start(async () => {
      const r = await commitAllPendingImports();
      setMsg(r.message);
      setOpen(false);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => setOpen(true)}
        disabled={pending || count === 0}
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />} Commit all ({count})
      </button>
      {msg && <span className="text-xs text-emerald-600">{msg}</span>}
      <ConfirmModal
        open={open}
        title={`Commit all ${count} pending import${count === 1 ? '' : 's'}?`}
        message="Each statement's reviewed lines will be imported into Finance and archived to Statements. You can still edit or clear them afterwards."
        confirmLabel="Commit all"
        pending={pending}
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
