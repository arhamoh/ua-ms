import Logo from '@/components/Logo';
import ForgotForm from './ForgotForm';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <Logo className="text-5xl" />
          <p className="mt-3 text-sm text-slate-500">Reset your password</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ForgotForm />
        </div>
      </div>
    </div>
  );
}
