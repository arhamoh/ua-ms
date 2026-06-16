import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold tracking-tight">Reset password</h1>
          <p className="mt-2 text-sm text-slate-600">
            Automated email resets are coming once we connect an email provider (this pairs
            with the upcoming invoicing/email feature).
          </p>
          <p className="mt-3 text-sm text-slate-600">
            For now, your administrator can reset it for you.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
