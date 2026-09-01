'use client';

import { useTransition } from 'react';
import { INCOME_CATEGORIES, INCOME_CATEGORY_LABELS } from '@/lib/enums';
import { updateOtherIncomeCategory, assignIncomeToClient } from '@/app/actions';

// Inline controls for an income row: change its category, or assign it to a
// client (which converts it into a payment on that client's profile).
export default function IncomeControls({
  id,
  category,
  clients,
}: {
  id: string;
  category: string;
  clients: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const cls =
    'rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand focus:outline-none disabled:opacity-50';

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        value={category}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          start(async () => {
            await updateOtherIncomeCategory(id, v);
          });
        }}
        className={cls}
        title="Income category"
      >
        {INCOME_CATEGORIES.map((c) => (
          <option key={c} value={c}>{INCOME_CATEGORY_LABELS[c]}</option>
        ))}
      </select>

      <select
        value=""
        disabled={pending || clients.length === 0}
        onChange={(e) => {
          const cid = e.target.value;
          if (!cid) return;
          start(async () => {
            await assignIncomeToClient(id, cid);
          });
        }}
        className={`${cls} text-slate-500`}
        title="Assign to a client — moves it to their profile as a payment"
      >
        <option value="">{clients.length ? 'Assign to client…' : 'No clients yet'}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
