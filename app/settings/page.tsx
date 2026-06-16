import { Database, FileText, Trash2, SlidersHorizontal } from 'lucide-react';
import { seedDemoData, backfillInvoices, clearDemoData } from '@/app/actions';
import FadeIn from '@/components/FadeIn';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, string> = {
  seeded: 'Demo data added — explore the dashboard, finance, commissions, and invoices.',
  cleared: 'Demo data removed.',
  invoices: 'Generated invoices for any projects that were missing one.',
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  const { done } = await searchParams;

  return (
    <div className="max-w-3xl">
      <FadeIn>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Demo data and platform configuration.</p>
      </FadeIn>

      {done && MESSAGES[done] && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{MESSAGES[done]}</div>
      )}

      <FadeIn delay={0.06}>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-brand" />
            <h2 className="text-sm font-semibold">Demo data</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Populate the platform with sample clients, projects, payments, tasks, invoices, expenses,
            salaries, and commissions to see how everything looks. Demo records are prefixed “Demo —”.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={seedDemoData}>
              <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">
                <Database size={15} /> Add demo data
              </button>
            </form>
            <form action={backfillInvoices}>
              <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <FileText size={15} /> Generate missing invoices
              </button>
            </form>
            <form action={clearDemoData}>
              <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50">
                <Trash2 size={15} /> Clear demo data
              </button>
            </form>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-slate-400" />
            <h2 className="text-sm font-semibold">Dropdown options</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Editable option lists (project types, sources, expense categories, file types, payment
            methods, currencies, lead types) are coming here next — so you can customize them yourself.
          </p>
        </div>
      </FadeIn>
    </div>
  );
}
