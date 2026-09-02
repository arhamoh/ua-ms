'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eraser } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { clearStatementImport } from '@/app/actions';

// Clears a statement's import: deletes the transactions it created and the file,
// so it can be re-uploaded. Shown only for imported statements.
export default function ClearImportButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const run = () =>
    start(async () => {
      await clearStatementImport(id);
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Clear this import (delete its transactions & remove the file to redo)"
        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-amber-50 hover:text-amber-700"
      >
        <Eraser size={15} />
      </button>
      <ConfirmModal
        open={open}
        title={`Clear the import "${label}"?`}
        message="Deletes the expenses, income and transfers imported from this statement and removes the file, so you can re-upload it. Manual entries aren't affected."
        confirmLabel="Clear import"
        danger
        pending={pending}
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
