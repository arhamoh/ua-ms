import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Send, Check } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { setInvoiceStatus, emailInvoice } from '@/app/actions';
import { emailConfigured } from '@/lib/email';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE, formatMoney } from '@/lib/enums';
import { getCompany, computeTax } from '@/lib/company';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

function fmt(d: Date | null) {
  return d ? new Date(d).toISOString().slice(0, 10) : '—';
}

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { id } = await params;
  const { sent, error } = await searchParams;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true, project: true },
  });
  if (!inv) notFound();

  const company = await getCompany();
  const tax = computeTax(inv.amount, inv.client.taxRegion, company);
  const canEmail = emailConfigured();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 print:hidden">
        <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Invoices
        </Link>
      </div>

      {sent && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 print:hidden">
          Invoice emailed to the client.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700 print:hidden">{error}</div>
      )}

      {/* Action bar */}
      <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
        <PrintButton label="Print / Download PDF" />
        {canEmail ? (
          <form action={emailInvoice}>
            <input type="hidden" name="invoiceId" value={inv.id} />
            <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark">
              <Send size={15} /> Email to client
            </button>
          </form>
        ) : (
          <span className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400">
            Add RESEND_API_KEY to enable emailing
          </span>
        )}
        {inv.status !== 'PAID' && (
          <form action={setInvoiceStatus}>
            <input type="hidden" name="invoiceId" value={inv.id} />
            <input type="hidden" name="status" value="PAID" />
            <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Check size={15} /> Mark paid
            </button>
          </form>
        )}
      </div>

      {/* Invoice document */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-brand pb-5">
          <div className="text-sm">
            <div className="text-xl font-bold">{company.name}</div>
            {company.address && <div className="mt-0.5 text-slate-500">{company.address}</div>}
            {(company.email || company.phone) && (
              <div className="text-slate-500">{[company.email, company.phone].filter(Boolean).join(' · ')}</div>
            )}
            <div className="mt-1 space-y-0.5 text-xs text-slate-400">
              {company.gstNumber && <div>GST: {company.gstNumber}</div>}
              {company.qstNumber && <div>QST: {company.qstNumber}</div>}
              {company.neqNumber && <div>NEQ: {company.neqNumber}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-tight text-brand">INVOICE</div>
            <div className="mt-1 text-sm text-slate-500">#{inv.number}</div>
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_BADGE[inv.status]}`}>
              {INVOICE_STATUS_LABELS[inv.status]}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Bill to</div>
            <div className="mt-1 font-medium">{inv.client.name}</div>
            {inv.client.contactName && <div className="text-slate-500">{inv.client.contactName}</div>}
            {inv.client.email && <div className="break-words text-slate-500">{inv.client.email}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Details</div>
            <div className="mt-1 text-slate-600">Issued: {fmt(inv.issuedAt)}</div>
            <div className="text-slate-600">Due: {fmt(inv.dueAt)}</div>
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-3">{inv.project?.name ?? 'Project'}</td>
              <td className="py-3 text-right tabular-nums">{formatMoney(inv.amount, inv.currency)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-1.5 rounded-xl bg-slate-50 px-5 py-4 text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatMoney(tax.subtotal, inv.currency)}</span>
            </div>
            {tax.gst > 0 && (
              <div className="flex items-center justify-between text-slate-600">
                <span>GST ({company.gstRate}%)</span>
                <span className="tabular-nums">{formatMoney(tax.gst, inv.currency)}</span>
              </div>
            )}
            {tax.qst > 0 && (
              <div className="flex items-center justify-between text-slate-600">
                <span>QST ({company.qstRate}%)</span>
                <span className="tabular-nums">{formatMoney(tax.qst, inv.currency)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-base font-bold">
              <span className="text-xs uppercase tracking-wide text-slate-500">Total due</span>
              <span className="tabular-nums">{formatMoney(tax.total, inv.currency)}</span>
            </div>
          </div>
        </div>

        {inv.notes && <p className="mt-6 whitespace-pre-line text-sm text-slate-600">{inv.notes}</p>}
      </div>
    </div>
  );
}
