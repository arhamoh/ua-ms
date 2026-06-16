import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Receipt, Wallet, Scale, Plus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { recordPayment } from '@/app/actions';
import {
  PROJECT_STATUS_LABELS,
  STATUS_BADGE,
  PROJECT_TYPE_LABELS,
  CLIENT_SOURCE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  CURRENCIES,
  formatMoney,
} from '@/lib/enums';
import FadeIn from '@/components/FadeIn';
import { getRatesToCad, toCad } from '@/lib/fx';

export const dynamic = 'force-dynamic';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

function fmtDate(d: Date | null) {
  if (!d) return '—';
  return new Date(d).toISOString().split('T')[0];
}

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: { orderBy: { createdAt: 'desc' } },
      payments: {
        orderBy: { paidAt: 'desc' },
        include: { project: { select: { name: true } } },
      },
    },
  });

  if (!client) notFound();

  // All totals are normalized to CAD using live rates (payments lock in the
  // rate captured when recorded; projects/budgets convert at the current rate).
  const rates = await getRatesToCad();
  const billed = client.projects.reduce(
    (sum, p) => sum + (p.budgetAmount != null ? toCad(p.budgetAmount, p.budgetCurrency, rates) : 0),
    0,
  );
  const paid = client.payments.reduce(
    (sum, p) => sum + (p.amountCad ?? toCad(p.amount, p.currency, rates)),
    0,
  );
  const balance = billed - paid;

  const summary = [
    { label: 'Total billed', value: formatMoney(billed, 'CAD'), icon: Receipt, tint: 'bg-indigo-50 text-indigo-600' },
    { label: 'Total paid', value: formatMoney(paid, 'CAD'), icon: Wallet, tint: 'bg-emerald-50 text-emerald-600' },
    {
      label: 'Outstanding',
      value: formatMoney(balance, 'CAD'),
      icon: Scale,
      tint: balance > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500',
    },
  ];

  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      <FadeIn>
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
        >
          <ArrowLeft size={14} /> Clients
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
              {client.source && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {CLIENT_SOURCE_LABELS[client.source]}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {[client.contactName, client.email, client.phone].filter(Boolean).join(' · ') || 'No contact details'}
            </p>
          </div>
          <Link
            href={`/clients/${client.id}/new-project`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
          >
            <Plus size={16} /> New project
          </Link>
        </div>
      </FadeIn>

      {/* Billing summary */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary.map((s, i) => (
          <FadeIn key={s.label} delay={0.04 * i}>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${s.tint}`}>
                <s.icon size={20} />
              </span>
              <div className="mt-4 text-2xl font-semibold tracking-tight">{s.value}</div>
              <div className="mt-0.5 text-sm text-slate-500">{s.label}</div>
            </div>
          </FadeIn>
        ))}
      </section>
      <p className="mt-2 text-xs text-slate-400">
        Totals shown in CAD, converted at current exchange rates. Payments lock in the rate at the time they’re recorded.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* History */}
        <div className="space-y-6 lg:col-span-2">
          {/* Projects = billing history */}
          <FadeIn delay={0.08}>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold">Projects &amp; billing</h2>
              </div>
              {client.projects.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  No projects yet.{' '}
                  <Link href={`/clients/${client.id}/new-project`} className="font-medium text-brand hover:underline">
                    Add one
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Project</th>
                        <th className="px-5 py-3 font-medium">Type</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 text-right font-medium">Billed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {client.projects.map((p) => (
                        <tr key={p.id} className="transition hover:bg-slate-50">
                          <td className="px-5 py-3">
                            <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-brand">
                              {p.name}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-slate-500">{PROJECT_TYPE_LABELS[p.type] ?? p.type}</td>
                          <td className="px-5 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status] ?? ''}`}>
                              {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-medium tabular-nums">
                            {p.budgetAmount != null ? formatMoney(p.budgetAmount, p.budgetCurrency ?? 'CAD') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td colSpan={3} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Total billed (CAD)
                        </td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums">
                          {formatMoney(billed, 'CAD')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </FadeIn>

          {/* Payments */}
          <FadeIn delay={0.12}>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold">Payment history</h2>
              </div>
              {client.payments.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  No payments recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Date</th>
                        <th className="px-5 py-3 font-medium">Method</th>
                        <th className="px-5 py-3 font-medium">Project</th>
                        <th className="px-5 py-3 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {client.payments.map((p) => (
                        <tr key={p.id} className="transition hover:bg-slate-50">
                          <td className="px-5 py-3 tabular-nums text-slate-600">{fmtDate(p.paidAt)}</td>
                          <td className="px-5 py-3 text-slate-600">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</td>
                          <td className="px-5 py-3 text-slate-500">{p.project?.name ?? '—'}</td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            <div className="font-medium text-emerald-600">{formatMoney(p.amount, p.currency)}</div>
                            {p.currency !== 'CAD' && (
                              <div className="text-xs text-slate-400">
                                {formatMoney(p.amountCad ?? toCad(p.amount, p.currency, rates), 'CAD')} CAD
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td colSpan={3} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Total paid (CAD)
                        </td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums">
                          {formatMoney(paid, 'CAD')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </FadeIn>
        </div>

        {/* Record payment */}
        <FadeIn delay={0.16}>
          <form
            action={recordPayment}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-20"
          >
            <input type="hidden" name="clientId" value={client.id} />
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Plus size={16} className="text-brand" /> Record a payment
            </h2>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <label className="col-span-2 block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Amount *</span>
                  <input name="amount" type="number" min="0" step="any" required className={inputCls} placeholder="2000" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Currency</span>
                  <select name="currency" defaultValue="USD" className={inputCls}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Method</span>
                <select name="method" defaultValue="BANK_TRANSFER" className={inputCls}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Date</span>
                <input name="paidAt" type="date" defaultValue={today} className={inputCls} />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Project (optional)</span>
                <select name="projectId" defaultValue="" className={inputCls}>
                  <option value="">General / unassigned</option>
                  {client.projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Note</span>
                <input name="note" className={inputCls} placeholder="e.g. 50% deposit" />
              </label>

              <button
                type="submit"
                className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
              >
                Record payment
              </button>
            </div>
          </form>
        </FadeIn>
      </div>
    </div>
  );
}
