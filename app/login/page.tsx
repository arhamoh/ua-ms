import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Logo from '@/components/Logo';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  // Already signed in → go home.
  const session = await getSession();
  if (session) redirect('/');
  const { reset } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <Logo className="text-5xl" />
          <p className="mt-3 text-sm text-slate-500">The operating system your agency runs on.</p>
        </div>

        {reset && (
          <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-center text-sm text-emerald-700">
            Password updated — sign in with your new password.
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
