'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, Loader2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { revertStatementToPending } from '@/app/actions';

// Undo a committed statement: pulls its transactions back out of Finance and
// restores it as a pending import on the review board.
export default function RevertToPendingButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const run = () =>
    start(async () => {
      await revertStatementToPending(id);
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Revert to a pending import (undo the commit)"
        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-brand-light hover:text-brand"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
      </button>
      <ConfirmModal
        open={open}
        title={`Revert "${label}" to pending?`}
        message="Removes the transactions this statement created from Finance, and puts the statement back on the Import board so you can review it again."
        confirmLabel="Revert to pending"
        pending={pending}
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
