import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Already signed in → go home.
  const session = await getSession();
  if (session) redirect('/');

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-dark to-rose-400 text-base font-bold text-white">
            UA
          </span>
          <h1 className="mt-3 text-xl font-bold tracking-tight">Agency Platform</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
