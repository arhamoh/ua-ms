'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestPasswordReset, type ForgotState } from './actions';

const initial: ForgotState = {};

export default function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);

  if (state.done) {
    return (
      <div className="text-sm text-slate-600">
        <p>If an account matches that, a reset link is on its way. The link expires in 1 hour.</p>
        <Link href="/login" className="mt-5 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Email or username</span>
        <input
          name="identifier"
          type="text"
          required
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
          placeholder="you@agency.com"
        />
      </label>
      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send reset link'}
      </button>
      <div className="text-center">
        <Link href="/login" className="text-sm text-slate-500 hover:text-brand">Back to sign in</Link>
      </div>
    </form>
  );
}
