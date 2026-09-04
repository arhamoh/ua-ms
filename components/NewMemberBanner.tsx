'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, KeyRound, X, Mail, Loader2, AlertTriangle } from 'lucide-react';
import { sendWelcomeEmailNow } from '@/app/actions';

// One-time confirmation shown after adding a member: their sign-in details, so
// the admin can pass them along and/or send the welcome email manually.
export default function NewMemberBanner({
  userId,
  name,
  username,
  tempPassword,
  loginUrl,
  emailed,
}: {
  userId: string;
  name: string;
  username: string;
  tempPassword: string;
  loginUrl: string;
  emailed: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(emailed);
  const [err, setErr] = useState('');
  if (dismissed) return null;

  const sendEmailNow = () =>
    start(async () => {
      setErr('');
      const r = await sendWelcomeEmailNow(userId, tempPassword);
      if (r.ok) setSent(true); else setErr(r.error ?? 'Could not send.');
    });

  const summary = `Keel sign-in for ${name}\nLogin: ${loginUrl}\nUsername: ${username}\nTemporary password: ${tempPassword}`;

  return (
    <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-emerald-700" />
          <h3 className="text-sm font-semibold text-emerald-900">{name} was added</h3>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-emerald-700/70 hover:text-emerald-900"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      <p className="mt-1 text-xs text-emerald-800">
        {sent
          ? 'A welcome email with these details was sent to them. Here they are too, just in case:'
          : 'Share these sign-in details, or send the welcome email now. They’ll set their own password on first login.'}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="Login link" value={loginUrl} />
        <Field label="Username" value={username} />
        <Field label="Temporary password" value={tempPassword} mono />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CopyButton text={summary} label="Copy all details" />
        <button
          type="button"
          onClick={sendEmailNow}
          disabled={pending || sent}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : sent ? <Check size={14} /> : <Mail size={14} />}
          {sent ? 'Welcome email sent' : 'Send welcome email'}
        </button>
        {err && <span className="inline-flex items-center gap-1 text-xs text-rose-600"><AlertTriangle size={13} /> {err}</span>}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/70">{label}</div>
      <div className={`mt-0.5 truncate text-sm text-slate-800 ${mono ? 'font-mono' : ''}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard blocked — ignore */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied' : label}
    </button>
  );
}
