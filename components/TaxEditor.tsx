'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setExpenseTax, setPaymentTax, setOtherIncomeTax } from '@/app/actions';

const ACTIONS = { expense: setExpenseTax, payment: setPaymentTax, otherIncome: setOtherIncomeTax } as const;

// Inline GST/QST fixer for a single transaction. Recomputes the tax portion from
// the amount server-side.
export default function TaxEditor({
  id,
  kind,
  tax,
}: {
  id: string;
  kind: 'expense' | 'payment' | 'otherIncome';
  tax: 'none' | 'gst' | 'both';
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const onChange = (v: string) => start(async () => { await ACTIONS[kind](id, v); router.refresh(); });

  return (
    <select
      value={tax}
      onChange={(e) => onChange(e.target.value)}
      disabled={pending}
      title="GST/QST treatment"
      className={`rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] focus:border-brand focus:outline-none ${pending ? 'opacity-50' : ''} ${tax === 'none' ? 'text-slate-400' : 'text-slate-600'}`}
    >
      <option value="both">GST + QST</option>
      <option value="gst">GST only</option>
      <option value="none">No tax</option>
    </select>
  );
}
