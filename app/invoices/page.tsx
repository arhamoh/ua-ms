import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE, formatMoney } from '@/lib/enums';
import FadeIn from '@/components/FadeIn';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { number: 'desc' },
    include: { client: true, project: true },
  });

  return (
    <div>
      <FadeIn>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="mt-1 text-sm text-slate-500">
          An invoice is created automatically when a project is added. Open one to send or print it.
        </p>
      </FadeIn>

      <FadeIn delay={0.06}>
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {invoices.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No invoices yet. Onboard a client or add a project to generate one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">#</th>
                    <th className="px-5 py-3 font-medium">Client</th>
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link href={`/invoices/${inv.id}`} className="font-medium text-brand hover:underline">
                          #{inv.number}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{inv.client.name}</td>
                      <td className="px-5 py-3 text-slate-500">{inv.project?.name ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_BADGE[inv.status]}`}>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">
                        {formatMoney(inv.amount, inv.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
