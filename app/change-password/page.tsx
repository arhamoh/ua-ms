import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Logo from '@/components/Logo';
import ChangePasswordForm from './ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  // Already changed it? Nothing forced — send them home.
  if (!session.mustChangePassword) redirect('/');

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <Logo className="text-5xl" />
          <p className="mt-3 text-center text-sm text-slate-500">
            Welcome{session.name ? `, ${session.name}` : ''}! Set your own password to finish setting up your account.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
