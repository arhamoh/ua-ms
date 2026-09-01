import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE, formatMoney } from '@/lib/enums';
import FadeIn from '@/components/FadeIn';
import RowActions from '@/components/RowActions';
import Pill from '@/components/Pill';
import WaveImportButton from '@/components/WaveImportButton';
import { deleteInvoice } from '@/app/actions';
import { getSession } from '@/lib/auth';
import { waveConfigured } from '@/lib/wave';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const [invoices, session] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { number: 'desc' },
      include: { client: true, project: true, payments: { select: { amount: true, currency: true, amountCad: true } } },
    }),
    getSession(),
  ]);
  const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
  // Amount still owed on an invoice, in its own currency (best-effort across FX).
  const amountDue = (inv: (typeof invoices)[number]) => {
    if (inv.status === 'PAID') return 0;
    const paid = inv.payments.reduce(
      (s, p) => s + (p.currency === inv.currency ? p.amount : inv.currency === 'CAD' ? p.amountCad ?? 0 : 0),
      0,
    );
    return Math.max(0, inv.amount - paid);
  };
  const canWave = !!session?.roles?.includes('SUPER_ADMIN') && waveConfigured();

  return (
    <div>
      <FadeIn>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
            <p className="mt-1 text-sm text-slate-500">
              An invoice is created automatically when a project is added. Open one to send or print it.
            </p>
          </div>
          {canWave && <WaveImportButton />}
        </div>
      </FadeIn>

      <FadeIn delay={0.06}>
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {invoices.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No invoices yet. Onboard a client or add a project to generate one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">#</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Client</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Total</th>
                    <th className="px-5 py-3 text-right font-medium">Amount due</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => {
                    const due = amountDue(inv);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <Link href={`/invoices/${inv.id}`} className="font-medium text-brand hover:underline">
                            {inv.externalNumber ? inv.externalNumber : `#${inv.number}`}
                          </Link>
                        </td>
                        <td className="px-5 py-3 tabular-nums text-slate-500">{iso(inv.issuedAt)}</td>
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-700">{inv.client.name}</div>
                          {inv.project?.name && <div className="text-xs text-slate-400">{inv.project.name}</div>}
                        </td>
                        <td className="px-5 py-3">
                          <Pill className={INVOICE_STATUS_BADGE[inv.status]}>{INVOICE_STATUS_LABELS[inv.status]}</Pill>
                        </td>
                        <td className="px-5 py-3 text-right font-medium tabular-nums">
                          {formatMoney(inv.amount, inv.currency)}
                        </td>
                        <td className={`px-5 py-3 text-right tabular-nums ${due > 0 ? 'text-slate-600' : 'text-emerald-600'}`}>
                          {formatMoney(due, inv.currency)}
                        </td>
                        <td className="px-5 py-3">
                          <RowActions
                            viewHref={`/invoices/${inv.id}`}
                            editHref={`/invoices/${inv.id}/edit`}
                            deleteAction={deleteInvoice.bind(null, inv.id)}
                            label="invoice"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
