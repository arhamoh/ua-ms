'use client';

import { useState, useTransition } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { impersonate } from '@/app/actions';

// Super-Admin only: view the platform as this member.
export default function ImpersonateButton({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={() => start(async () => { setErr(''); const r = await impersonate(userId); if (r && !r.ok) setErr(r.error ?? 'Failed.'); })}
        disabled={pending}
        title="View the platform as this person"
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} View as
      </button>
      {err && <span className="text-[11px] text-rose-600">{err}</span>}
    </span>
  );
}
