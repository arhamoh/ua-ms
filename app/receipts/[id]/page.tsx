import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { emailReceipt } from '@/app/actions';
import { emailConfigured } from '@/lib/email';
import { PAYMENT_METHOD_LABELS, formatMoney, fxRateNote } from '@/lib/enums';
import { getCompany } from '@/lib/company';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

function fmt(d: Date) {
  return new Date(d).toISOString().slice(0, 10);
}

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { id } = await params;
  const { sent, error } = await searchParams;
  const p = await prisma.payment.findUnique({
    where: { id },
    include: { client: true, project: true },
  });
  if (!p) notFound();

  const company = await getCompany();
  const canEmail = emailConfigured();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 print:hidden">
        <Link href={`/clients/${p.clientId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> {p.client.name}
        </Link>
      </div>

      {sent && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 print:hidden">Receipt emailed to the client.</div>}
      {error && <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700 print:hidden">{error}</div>}

      <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
        <PrintButton label="Print / Download PDF" />
        {canEmail ? (
          <form action={emailReceipt}>
            <input type="hidden" name="paymentId" value={p.id} />
            <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark">
              <Send size={15} /> Email to client
            </button>
          </form>
        ) : (
          <span className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400">
            Add RESEND_API_KEY to enable emailing
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-brand pb-5">
          <div className="text-sm">
            <div className="text-xl font-bold">{company.name}</div>
            {company.address && <div className="mt-0.5 text-slate-500">{company.address}</div>}
            {(company.email || company.phone) && (
              <div className="text-slate-500">{[company.email, company.phone].filter(Boolean).join(' · ')}</div>
            )}
          </div>
          <div className="text-2xl font-bold tracking-tight text-brand">RECEIPT</div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Received from</div>
            <div className="mt-1 font-medium">{p.client.name}</div>
            {p.project && <div className="text-slate-500">{p.project.name}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Details</div>
            <div className="mt-1 text-slate-600">Date: {fmt(p.paidAt)}</div>
            <div className="text-slate-600">Method: {PAYMENT_METHOD_LABELS[p.method] ?? p.method}</div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <div className="w-56 rounded-xl bg-emerald-50 px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-emerald-600">Amount paid</span>
              <span className="text-lg font-bold tabular-nums text-emerald-700">{formatMoney(p.amount, p.currency)}</span>
            </div>
            {p.currency !== 'CAD' && p.amountCad != null && (
              <div className="mt-1 text-right text-[11px] text-slate-400 print:hidden">
                {formatMoney(p.amountCad, 'CAD')} CAD <span className="text-slate-300">({fxRateNote(p.amount, p.amountCad, p.currency)})</span>
              </div>
            )}
          </div>
        </div>

        {p.note && <p className="mt-6 whitespace-pre-line text-sm text-slate-600">{p.note}</p>}
      </div>
    </div>
  );
}
