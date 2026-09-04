'use client';

import { useState, useTransition } from 'react';
import { Mail, Loader2, Check, AlertTriangle } from 'lucide-react';
import { resendWelcome } from '@/app/actions';

// Shown for members still on a temporary password: resets their temp password,
// emails the welcome/instructions, and shows the new password to copy.
export default function ResendWelcomeButton({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; tempPassword?: string; emailed?: boolean; error?: string } | null>(null);

  const send = () =>
    start(async () => {
      setResult(null);
      setResult(await resendWelcome(userId));
    });

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={send}
        disabled={pending}
        title="Send welcome email (resets their temporary password)"
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />} Welcome
      </button>
      {result && (
        result.ok ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
            <Check size={11} /> {result.emailed ? 'Emailed' : 'Reset'} · temp: <code className="font-mono">{result.tempPassword}</code>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-rose-600"><AlertTriangle size={11} /> {result.error}</span>
        )
      )}
    </div>
  );
}
