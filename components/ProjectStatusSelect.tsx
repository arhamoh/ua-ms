'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setProjectStatus } from '@/app/actions';
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, STATUS_BADGE } from '@/lib/enums';

export default function ProjectStatusSelect({
  projectId,
  status,
}: {
  projectId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        startTransition(async () => {
          await setProjectStatus(projectId, v);
          router.refresh();
        });
      }}
      className={`cursor-pointer rounded-full border-0 py-1 pl-2.5 pr-7 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand/30 ${
        STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-600'
      } ${pending ? 'opacity-60' : ''}`}
    >
      {PROJECT_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-white text-slate-800">
          {PROJECT_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
