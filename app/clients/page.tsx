import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/enums';
import { getRatesToCad, toCad } from '@/lib/fx';
import { deleteClient } from '@/app/actions';
import RowActions from '@/components/RowActions';
import Pill from '@/components/Pill';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const [clients, rates] = await Promise.all([
    prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        projects: { select: { budgetAmount: true, budgetCurrency: true } },
        payments: { select: { amount: true, currency: true, amountCad: true } },
      },
    }),
    getRatesToCad(),
  ]);

  // Normalize lifetime billed / paid to CAD; pending = billed − paid.
  const rows = clients.map((c) => {
    const billed = c.projects.reduce(
      (s, p) => s + (p.budgetAmount != null ? toCad(p.budgetAmount, p.budgetCurrency, rates) : 0),
      0,
    );
    const paid = c.payments.reduce(
      (s, p) => s + (p.amountCad ?? toCad(p.amount, p.currency, rates)),
      0,
    );
    return { c, billed, paid, pending: billed - paid, projectCount: c.projects.length };
  });

  const totalBilled = rows.reduce((s, r) => s + r.billed, 0);
  const totalPending = rows.reduce((s, r) => s + r.pending, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">
            {clients.length} client{clients.length === 1 ? '' : 's'} · {formatMoney(totalBilled, 'CAD')} billed ·{' '}
            {formatMoney(totalPending, 'CAD')} pending
          </p>
        </div>
        <Link
          href="/onboard"
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
        >
          <UserPlus size={16} /> Onboard Client
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">No clients yet.</p>
          <Link
            href="/onboard"
            className="mt-3 inline-block rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Onboard your first client
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Projects</th>
                  <th className="px-5 py-3 text-right font-medium">Lifetime bill</th>
                  <th className="px-5 py-3 text-right font-medium">Paid</th>
                  <th className="px-5 py-3 text-right font-medium">Pending</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ c, billed, paid, pending, projectCount }) => (
                  <tr key={c.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`/clients/${c.id}`} className="font-medium text-slate-900 hover:text-brand">
                        {c.name}
                      </Link>
                      <div className="text-xs text-slate-400">
                        {[c.contactName, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 tabular-nums">{projectCount}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums">{formatMoney(billed, 'CAD')}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-600">{formatMoney(paid, 'CAD')}</td>
                    <td
                      className={`px-5 py-3 text-right font-medium tabular-nums ${
                        pending > 0.5 ? 'text-rose-600' : 'text-slate-400'
                      }`}
                    >
                      {formatMoney(pending, 'CAD')}
                    </td>
                    <td className="px-5 py-3">
                      {billed < 0.5 ? (
                        <Pill className="bg-slate-100 text-slate-500">No bills</Pill>
                      ) : pending > 0.5 ? (
                        <Pill className="bg-rose-100 text-rose-700">Owed</Pill>
                      ) : (
                        <Pill className="bg-emerald-100 text-emerald-700">Paid</Pill>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <RowActions
                        viewHref={`/clients/${c.id}`}
                        editHref={`/clients/${c.id}/edit`}
                        deleteAction={deleteClient.bind(null, c.id)}
                        label="client"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <td className="px-5 py-3" colSpan={2}>
                    Total (CAD)
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatMoney(totalBilled, 'CAD')}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatMoney(rows.reduce((s, r) => s + r.paid, 0), 'CAD')}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatMoney(totalPending, 'CAD')}</td>
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">
        Lifetime bill and pending are shown in CAD, converted at current exchange rates.
      </p>
    </div>
  );
}
