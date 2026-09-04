'use client';

import { useState, useTransition } from 'react';
import { KeyRound, Mail, Loader2, Check, AlertTriangle, ChevronDown } from 'lucide-react';
import { sendPasswordReset, adminSetPassword } from '@/app/actions';

// Manage a member's password: send a self-service reset link (preferred), or set
// a password directly (no forced change).
export default function MemberPasswordActions({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showDirect, setShowDirect] = useState(false);
  const [pw, setPw] = useState('');

  const sendReset = () =>
    start(async () => {
      setMsg(null);
      const r = await sendPasswordReset(userId);
      setMsg(r.ok ? { ok: true, text: 'Reset link emailed — it expires in 1 hour.' } : { ok: false, text: r.error ?? 'Failed.' });
    });

  const setDirect = () =>
    start(async () => {
      setMsg(null);
      const r = await adminSetPassword(userId, pw);
      if (r.ok) { setPw(''); setMsg({ ok: true, text: 'Password set — they can sign in with it now.' }); }
      else setMsg({ ok: false, text: r.error ?? 'Failed.' });
    });

  return (
    <div className="mt-4 max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-brand" />
        <h2 className="text-sm font-semibold">Password</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">Send them a reset link so they can set their own password.</p>

      <button
        onClick={sendReset}
        disabled={pending}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Send password reset
      </button>

      <button
        type="button"
        onClick={() => setShowDirect((v) => !v)}
        className="ml-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
      >
        or set a password directly <ChevronDown size={13} className={showDirect ? 'rotate-180 transition' : 'transition'} />
      </button>

      {showDirect && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <input
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            minLength={8}
            autoComplete="off"
            placeholder="New password (min 8 chars)"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
          <button onClick={setDirect} disabled={pending || pw.length < 8} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <KeyRound size={14} /> Set
          </button>
          <span className="w-full text-[11px] text-slate-400">They sign in with it immediately and are not forced to change it.</span>
        </div>
      )}

      {msg && (
        <p className={`mt-2 inline-flex items-center gap-1 text-xs ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
          {msg.ok ? <Check size={13} /> : <AlertTriangle size={13} />} {msg.text}
        </p>
      )}
    </div>
  );
}
