'use client';

import { useState, useTransition } from 'react';
import { KeyRound, Loader2, Check, AlertTriangle } from 'lucide-react';
import { adminSetPassword } from '@/app/actions';

// Admin sets a member's password directly — they can log in with it immediately,
// and are NOT forced to change it (unlike the welcome/temp-password flow).
export default function AdminSetPassword({ userId }: { userId: string }) {
  const [pw, setPw] = useState('');
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const save = () =>
    start(async () => {
      setResult(null);
      const r = await adminSetPassword(userId, pw);
      if (r.ok) { setPw(''); setResult({ ok: true, message: 'Password set — they can sign in with it now.' }); }
      else setResult({ ok: false, message: r.error ?? 'Failed.' });
    });

  return (
    <div className="mt-4 max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-brand" />
        <h2 className="text-sm font-semibold">Set a password</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Set this member’s password directly. They can sign in with it right away and won’t be forced to change it.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          minLength={8}
          autoComplete="off"
          placeholder="New password (min 8 chars)"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <button
          onClick={save}
          disabled={pending || pw.length < 8}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Set password
        </button>
      </div>
      {result && (
        <p className={`mt-2 inline-flex items-center gap-1 text-xs ${result.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
          {result.ok ? <Check size={13} /> : <AlertTriangle size={13} />} {result.message}
        </p>
      )}
    </div>
  );
}
