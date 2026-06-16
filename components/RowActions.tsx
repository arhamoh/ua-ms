'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';

const btn =
  'grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50';

export default function RowActions({
  viewHref,
  editHref,
  deleteAction,
  label = 'item',
}: {
  viewHref?: string;
  editHref?: string;
  /** A server action bound to the row id, e.g. deleteClient.bind(null, c.id) */
  deleteAction?: () => Promise<void>;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center justify-end gap-1">
      {viewHref && (
        <Link href={viewHref} className={btn} title="View" aria-label="View">
          <Eye size={15} />
        </Link>
      )}
      {editHref && (
        <Link href={editHref} className={btn} title="Edit" aria-label="Edit">
          <Pencil size={15} />
        </Link>
      )}
      {deleteAction && (
        <button
          type="button"
          disabled={pending}
          title="Delete"
          aria-label="Delete"
          onClick={() => {
            if (!window.confirm(`Delete this ${label}? This can’t be undone.`)) return;
            start(async () => {
              await deleteAction();
              router.refresh();
            });
          }}
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
