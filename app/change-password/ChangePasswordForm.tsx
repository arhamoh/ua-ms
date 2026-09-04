'use client';

import { useActionState } from 'react';
import { submitNewPassword, type ChangePwState } from './actions';

const initial: ChangePwState = {};

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState(submitNewPassword, initial);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">New password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoFocus
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
          placeholder="At least 8 characters"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
          placeholder="Re-enter your new password"
        />
      </label>

      {state.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Set password & continue'}
      </button>
    </form>
  );
}
