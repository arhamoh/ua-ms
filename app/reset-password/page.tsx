import Link from 'next/link';
import Logo from '@/components/Logo';
import { checkResetToken } from '@/lib/reset';
import ResetForm from './ResetForm';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = token ? await checkResetToken(token) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <Logo className="text-5xl" />
          <p className="mt-3 text-sm text-slate-500">Set a new password</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {valid ? (
            <ResetForm token={token!} />
          ) : (
            <div className="text-sm text-slate-600">
              <p>This reset link is invalid or has expired.</p>
              <Link href="/forgot-password" className="mt-5 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark">
                Request a new link
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
