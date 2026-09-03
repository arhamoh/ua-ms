'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, AtSign, Check, AlertTriangle } from 'lucide-react';
import { changeUsername, changePassword } from '@/app/actions';

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

function Result({ r }: { r: { ok: boolean; message: string } | null }) {
  if (!r) return null;
  return (
    <p className={`mt-2 inline-flex items-center gap-1 text-xs ${r.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
      {r.ok ? <Check size={13} /> : <AlertTriangle size={13} />} {r.message}
    </p>
  );
}

export default function AccountSettings({ currentUsername, currentEmail }: { currentUsername: string | null; currentEmail: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [username, setUsername] = useState('');
  const [nameRes, setNameRes] = useState<{ ok: boolean; message: string } | null>(null);

  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwRes, setPwRes] = useState<{ ok: boolean; message: string } | null>(null);

  const current = currentUsername || currentEmail;

  const submitName = () =>
    start(async () => {
      const r = await changeUsername(username);
      setNameRes(r);
      if (r.ok) { setUsername(''); router.refresh(); }
    });

  const submitPw = () => {
    if (newPw !== confirmPw) { setPwRes({ ok: false, message: 'Passwords don’t match.' }); return; }
    start(async () => {
      const r = await changePassword(newPw);
      setPwRes(r);
      if (r.ok) { setNewPw(''); setConfirmPw(''); }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-brand" />
        <h2 className="text-sm font-semibold">Login information</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Sign in with your username or email. Current login: <span className="font-medium text-slate-700">{current}</span>
      </p>

      {/* Username / email */}
      <div className="mt-4 max-w-md">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Username or email</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={current} autoCapitalize="none" autoCorrect="off" className={inputCls} />
        </label>
        <div className="mt-2">
          <button onClick={submitName} disabled={pending || !username.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50">
            <AtSign size={15} /> Update username
          </button>
          <Result r={nameRes} />
        </div>
      </div>

      <div className="my-5 border-t border-slate-100" />

      {/* Password: just new + confirm */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">New password</span>
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Confirm new password</span>
          <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" className={inputCls} />
        </label>
      </div>
      <div className="mt-2">
        <button onClick={submitPw} disabled={pending || !newPw} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <KeyRound size={15} /> Update password
        </button>
        <Result r={pwRes} />
      </div>
    </div>
  );
}
