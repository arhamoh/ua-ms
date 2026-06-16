import { Database, FileText, Trash2, SlidersHorizontal, Plus, X } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { seedDemoData, backfillInvoices, clearDemoData, addOption, deleteOption } from '@/app/actions';
import { ensureOptionsSeeded, OPTION_KINDS } from '@/lib/options';
import FadeIn from '@/components/FadeIn';

export const dynamic = 'force-dynamic';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

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
  await ensureOptionsSeeded();
  const allOptions = await prisma.optionItem.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
  const byKind: Record<string, typeof allOptions> = {};
  for (const o of allOptions) (byKind[o.kind] ??= []).push(o);

  return (
    <div className="max-w-3xl">
      <FadeIn>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Dropdown options and demo data.</p>
      </FadeIn>

      {done && MESSAGES[done] && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{MESSAGES[done]}</div>
      )}

      {/* Dropdown options */}
      <FadeIn delay={0.05}>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-brand" />
            <h2 className="text-sm font-semibold">Dropdown options</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Customize the choices that appear in dropdowns across the app. Add or remove items freely.
          </p>

          <div className="mt-5 space-y-6">
            {OPTION_KINDS.map((k) => {
              const items = byKind[k.kind] ?? [];
              return (
                <div key={k.kind}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{k.label}</h3>
                  <div className="flex flex-wrap gap-2">
                    {items.map((it) => (
                      <span key={it.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-sm">
                        {it.label}
                        {it.rate != null && <span className="text-xs text-slate-400">{it.rate}%</span>}
                        <form action={deleteOption}>
                          <input type="hidden" name="id" value={it.id} />
                          <button className="grid h-5 w-5 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-rose-600" aria-label={`Remove ${it.label}`}>
                            <X size={12} />
                          </button>
                        </form>
                      </span>
                    ))}
                  </div>
                  <form action={addOption} className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="kind" value={k.kind} />
                    <input
                      name="label"
                      required
                      placeholder={k.kind === 'currency' ? 'Code (e.g. JPY)' : 'New option…'}
                      className={`${inputCls} w-44`}
                    />
                    {k.hasRate && (
                      <input name="rate" type="number" step="any" min="0" placeholder="%" className={`${inputCls} w-20`} />
                    )}
                    <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <Plus size={14} /> Add
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      </FadeIn>

      {/* Demo data */}
      <FadeIn delay={0.1}>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-brand" />
            <h2 className="text-sm font-semibold">Demo data</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Populate the platform with sample clients, projects, payments, tasks, invoices, expenses,
            salaries, and commissions. Demo records are prefixed “Demo —”.
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
    </div>
  );
}
