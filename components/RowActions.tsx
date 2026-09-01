'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

const MotionLink = motion.create(Link);
const hover = { scale: 1.12 };
const tap = { scale: 0.9 };
const spring = { type: 'spring' as const, stiffness: 400, damping: 22 };

const btn =
  'grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50';

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
  const [confirming, setConfirming] = useState(false);

  const doDelete = () => {
    start(async () => {
      if (deleteAction) await deleteAction();
      setConfirming(false);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      {viewHref && (
        <MotionLink href={viewHref} className={btn} title="View" aria-label="View" whileHover={hover} whileTap={tap} transition={spring}>
          <Eye size={15} />
        </MotionLink>
      )}
      {editHref && (
        <MotionLink href={editHref} className={btn} title="Edit" aria-label="Edit" whileHover={hover} whileTap={tap} transition={spring}>
          <Pencil size={15} />
        </MotionLink>
      )}
      {deleteAction && (
        <motion.button
          type="button"
          disabled={pending}
          title="Delete"
          aria-label="Delete"
          whileHover={hover}
          whileTap={tap}
          transition={spring}
          onClick={() => setConfirming(true)}
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
        >
          <Trash2 size={15} />
        </motion.button>
      )}
      <ConfirmModal
        open={confirming}
        title={`Delete this ${label}?`}
        message="This can’t be undone."
        confirmLabel="Delete"
        danger
        pending={pending}
        onConfirm={doDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
