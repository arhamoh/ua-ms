'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Undo2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { undoLastImport } from '@/app/actions';

// One-click undo of the most recent import batch → back to pending.
export default function UndoLastImportButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);

  const run = () =>
    start(async () => {
      const r = await undoLastImport();
      setRes(r);
      setOpen(false);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => setOpen(true)}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />} Undo last import
      </button>
      {res && (
        <span className={`inline-flex items-center gap-1 text-xs ${res.ok ? 'text-emerald-700' : 'text-rose-600'}`}>
          {res.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {res.message}
        </span>
      )}
      <ConfirmModal
        open={open}
        title="Undo the last import?"
        message="Reverts the most recently committed statements: their transactions are removed from Finance and the statements go back to the Import board as pending drafts to review."
        confirmLabel="Undo last import"
        pending={pending}
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
