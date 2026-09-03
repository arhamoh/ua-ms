'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, AtSign, Check, AlertTriangle } from 'lucide-react';
import { changeEmail, changePassword } from '@/app/actions';

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

function Result({ r }: { r: { ok: boolean; message: string } | null }) {
  if (!r) return null;
  return (
    <p className={`mt-2 inline-flex items-center gap-1 text-xs ${r.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
      {r.ok ? <Check size={13} /> : <AlertTriangle size={13} />} {r.message}
    </p>
  );
}

export default function AccountSettings({ currentEmail }: { currentEmail: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [email, setEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [emailRes, setEmailRes] = useState<{ ok: boolean; message: string } | null>(null);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwRes, setPwRes] = useState<{ ok: boolean; message: string } | null>(null);

  const submitEmail = () =>
    start(async () => {
      const r = await changeEmail(email, emailPw);
      setEmailRes(r);
      if (r.ok) { setEmail(''); setEmailPw(''); router.refresh(); }
    });

  const submitPw = () => {
    if (newPw !== confirmPw) { setPwRes({ ok: false, message: 'New passwords don’t match.' }); return; }
    start(async () => {
      const r = await changePassword(curPw, newPw);
      setPwRes(r);
      if (r.ok) { setCurPw(''); setNewPw(''); setConfirmPw(''); }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-brand" />
        <h2 className="text-sm font-semibold">Login information</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Your username is your email. Current: <span className="font-medium text-slate-700">{currentEmail}</span>
      </p>

      {/* Change email */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">New email (username)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={currentEmail} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Current password</span>
          <input type="password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} autoComplete="current-password" className={inputCls} />
        </label>
      </div>
      <div className="mt-2">
        <button onClick={submitEmail} disabled={pending || !email.trim() || !emailPw} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50">
          <AtSign size={15} /> Update email
        </button>
        <Result r={emailRes} />
      </div>

      <div className="my-5 border-t border-slate-100" />

      {/* Change password */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Current password</span>
          <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" className={inputCls} />
        </label>
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
        <button onClick={submitPw} disabled={pending || !curPw || !newPw} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <KeyRound size={15} /> Update password
        </button>
        <Result r={pwRes} />
      </div>
    </div>
  );
}
