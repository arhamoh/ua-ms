import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Send, Check, Plus, Link2, Unlink, Receipt } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { setInvoiceStatus, emailInvoice, recordPayment, deletePayment, linkPaymentToInvoice, unlinkPaymentFromInvoice, recordInvoiceFee } from '@/app/actions';
import { emailConfigured } from '@/lib/email';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, CURRENCIES, formatMoney, fxRateNote } from '@/lib/enums';
import { getCompany, computeTax } from '@/lib/company';
import { getRatesToCad, toCad } from '@/lib/fx';
import PrintButton from '@/components/PrintButton';
import RowActions from '@/components/RowActions';

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
    include: { client: true, project: true, payments: { orderBy: { paidAt: 'desc' } } },
  });
  if (!inv) notFound();

  const company = await getCompany();
  const tax = computeTax(inv.amount, inv.client.taxRegion, company);
  const canEmail = emailConfigured();
  const rates = await getRatesToCad();
  const totalCad = inv.currency !== 'CAD' ? toCad(tax.total, inv.currency, rates) : null;

  // Other payments from this client not yet linked to any invoice — candidates
  // to attach as (possibly partial) deposits against this invoice.
  const unlinked = await prisma.payment.findMany({
    where: { clientId: inv.clientId, invoiceId: null },
    orderBy: { paidAt: 'desc' },
    take: 50,
  });

  // Receivables: how much of this invoice's total (incl. tax, CAD) is deposited.
  const totalCadAll = toCad(tax.total, inv.currency, rates);
  const paidCad = inv.payments.reduce((s, p) => s + (p.amountCad ?? toCad(p.amount, p.currency, rates)), 0);
  const outstandingCad = Math.max(totalCadAll - paidCad, 0);
  // When settled (PAID) but deposits fall short, the gap is the processing fee.
  const feeGapCad = inv.status === 'PAID' ? Math.max(totalCadAll - paidCad, 0) : 0;
  const today = new Date().toISOString().split('T')[0];

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
            Connect Google to enable emailing
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
            {totalCad != null && (
              <div className="pt-1 text-right text-[11px] text-slate-400 print:hidden">
                ≈ {formatMoney(totalCad, 'CAD')} CAD <span className="text-slate-300">({fxRateNote(tax.total, totalCad, inv.currency)} · today’s rate)</span>
              </div>
            )}
          </div>
        </div>

        {inv.notes && <p className="mt-6 whitespace-pre-line text-sm text-slate-600">{inv.notes}</p>}
      </div>

      {/* Payments & reconciliation — screen only */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold">Payments &amp; reconciliation</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-slate-400">Total <span className="font-medium tabular-nums text-slate-600">{formatMoney(totalCadAll, 'CAD')}</span></span>
            <span className="text-slate-400">Deposited <span className="font-medium tabular-nums text-emerald-700">{formatMoney(paidCad, 'CAD')}</span></span>
            {inv.status === 'PAID' ? (
              feeGapCad > 0.5 && <span className="text-slate-400">Fee / short <span className="font-medium tabular-nums text-amber-700">{formatMoney(feeGapCad, 'CAD')}</span></span>
            ) : (
              <span className="text-slate-400">Outstanding <span className={`font-medium tabular-nums ${outstandingCad > 0.5 ? 'text-amber-700' : 'text-slate-400'}`}>{formatMoney(outstandingCad, 'CAD')}</span></span>
            )}
          </div>
        </div>

        {feeGapCad > 0.5 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-amber-50/50 px-5 py-2.5 text-xs">
            <span className="text-amber-800">Deposits are {formatMoney(feeGapCad, 'CAD')} short of the total — likely a withdrawal / processing fee.</span>
            <form action={recordInvoiceFee}>
              <input type="hidden" name="invoiceId" value={inv.id} />
              <input type="hidden" name="amount" value={feeGapCad.toFixed(2)} />
              <button className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-medium text-amber-800 transition hover:bg-amber-50">
                <Receipt size={13} /> Record as fee expense
              </button>
            </form>
          </div>
        )}

        {inv.payments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <tbody className="divide-y divide-slate-100">
                {inv.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}{p.bankMatchedAt && <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">reconciled</span>}</td>
                    <td className="px-5 py-3 tabular-nums text-slate-500">{p.paidAt.toISOString().slice(0, 10)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(p.amount, p.currency)}{p.currency !== 'CAD' && <span className="ml-2 text-xs text-slate-400">{formatMoney(p.amountCad ?? toCad(p.amount, p.currency, rates), 'CAD')} CAD</span>}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <form action={unlinkPaymentFromInvoice.bind(null, p.id)}>
                          <button title="Unlink from this invoice (keeps the payment in the ledger)" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-amber-600">
                            <Unlink size={15} />
                          </button>
                        </form>
                        <RowActions deleteAction={deletePayment.bind(null, p.id)} label="payment" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {unlinked.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Link a deposit from imported transactions</div>
            <p className="mt-1 text-xs text-slate-400">
              Attach bank deposits from {inv.client.name}. Deposits can be partial — link each withdrawal, then Mark paid once the invoice is settled (the shortfall is the processing fee).
            </p>
            <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100">
              {unlinked.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate text-slate-700">{p.note || (PAYMENT_METHOD_LABELS[p.method] ?? p.method)}</div>
                    <div className="text-xs text-slate-400">
                      {p.paidAt.toISOString().slice(0, 10)} · {formatMoney(p.amount, p.currency)}
                      {p.currency !== 'CAD' && ` · ${formatMoney(p.amountCad ?? toCad(p.amount, p.currency, rates), 'CAD')} CAD`}
                    </div>
                  </div>
                  <form action={linkPaymentToInvoice.bind(null, p.id, inv.id)}>
                    <button className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-brand">
                      <Link2 size={13} /> Link
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form action={recordPayment} className="grid grid-cols-1 gap-3 border-t border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="clientId" value={inv.clientId} />
          <input type="hidden" name="invoiceId" value={inv.id} />
          <input type="hidden" name="projectId" value={inv.projectId ?? ''} />
          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">Amount *</span><input name="amount" type="number" min="0" step="any" required defaultValue={outstandingCad > 0.5 && inv.currency === 'CAD' ? outstandingCad.toFixed(2) : ''} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none" placeholder="500" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Cur</span><select name="currency" defaultValue={inv.currency} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-brand focus:outline-none">{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          </div>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Method</span><select name="method" defaultValue="BANK_TRANSFER" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none">{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Date</span><input name="paidAt" type="date" defaultValue={today} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none" /></label>
          <div className="flex items-end"><button className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"><Plus size={15} /> Record payment</button></div>
        </form>
      </div>
    </div>
  );
}
