'use client';

import { useTransition } from 'react';
import { Landmark, CreditCard } from 'lucide-react';
import { setPendingImportType } from '@/app/actions';

// A one-click Bank ↔ Credit card toggle for a pending import row.
export default function PendingTypeToggle({ id, type }: { id: string; type: string }) {
  const [pending, start] = useTransition();
  const isCard = type === 'CREDIT_CARD';
  const next = isCard ? 'BANK' : 'CREDIT_CARD';
  return (
    <button
      onClick={() => start(async () => { await setPendingImportType(id, next); })}
      disabled={pending}
      title={`Switch to ${isCard ? 'bank account' : 'credit card'}`}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
    >
      {isCard ? <CreditCard size={12} /> : <Landmark size={12} />}
      {isCard ? 'Credit card' : 'Bank'}
    </button>
  );
}
