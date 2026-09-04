'use client';

import { useState, useTransition } from 'react';
import { Send, Loader2, CheckCircle2, AlertTriangle, Mail } from 'lucide-react';
import { sendTestEmail } from '@/app/actions';

// A quick way to confirm the email setup works: sends a sample welcome email to
// yourself (or any address) using the live Resend config.
export default function EmailTestPanel({ defaultTo, emailReady }: { defaultTo: string; emailReady: boolean }) {
  const [to, setTo] = useState(defaultTo);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const send = () =>
    start(async () => {
      setResult(null);
      setResult(await sendTestEmail(to));
    });

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Mail size={16} className="text-brand" />
        <h3 className="text-sm font-semibold text-slate-800">Send a test email</h3>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Sends a sample welcome email so you can see exactly what new members receive.
        {!emailReady && ' Connect Google (or configure Resend) above first.'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && emailReady) send(); }}
          placeholder="you@agency.com"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
        />
        <button
          onClick={send}
          disabled={pending || !emailReady}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send test
        </button>
      </div>
      {result && (
        <p className={`mt-2 inline-flex items-center gap-1 text-xs ${result.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
          {result.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {result.message}
        </p>
      )}
    </div>
  );
}
