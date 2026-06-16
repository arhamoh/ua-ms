'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login, type LoginState } from './actions';

const initial: LoginState = {};

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
        <input
          name="email"
          type="email"
          required
          autoFocus
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
          placeholder="you@agency.com"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
        <input
          name="password"
          type="password"
          required
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
          placeholder="••••••••"
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
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      <div className="text-center">
        <Link href="/forgot-password" className="text-sm text-slate-500 hover:text-brand">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
