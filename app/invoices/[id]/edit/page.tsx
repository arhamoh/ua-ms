import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { updateInvoice } from '@/app/actions';
import { INVOICE_STATUS_LABELS, CURRENCIES } from '@/lib/enums';
import FadeIn from '@/components/FadeIn';

export const dynamic = 'force-dynamic';

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';
const STATUSES = ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'VOID'];

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [inv, clients] = await Promise.all([
    prisma.invoice.findUnique({ where: { id }, include: { client: true } }),
    prisma.client.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  if (!inv) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4">
        <Link href={`/invoices/${inv.id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Back to invoice
        </Link>
      </div>
      <FadeIn>
        <h1 className="text-2xl font-bold tracking-tight">Edit invoice {inv.externalNumber ? inv.externalNumber : `#${inv.number}`}</h1>
        <p className="mt-1 text-sm text-slate-500">Changes reflect on the invoice, Finance, and the client profile.</p>

        <form action={updateInvoice} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <input type="hidden" name="invoiceId" value={inv.id} />

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Client</span>
            <select name="clientId" defaultValue={inv.clientId} className={inputCls}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">Amount (subtotal, pre-tax)</span>
              <input name="amount" type="number" min="0" step="any" defaultValue={inv.amount} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Currency</span>
              <select name="currency" defaultValue={inv.currency} className={inputCls}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Status</span>
              <select name="status" defaultValue={inv.status} className={inputCls}>
                {STATUSES.map((s) => <option key={s} value={s}>{INVOICE_STATUS_LABELS[s] ?? s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Issued</span>
              <input name="issuedAt" type="date" defaultValue={iso(inv.issuedAt)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Due</span>
              <input name="dueAt" type="date" defaultValue={iso(inv.dueAt)} className={inputCls} />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Notes</span>
            <textarea name="notes" rows={3} defaultValue={inv.notes ?? ''} className={inputCls} />
          </label>

          <div className="flex justify-end gap-2">
            <Link href={`/invoices/${inv.id}`} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</Link>
            <button className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">Save changes</button>
          </div>
        </form>
      </FadeIn>
    </div>
  );
}
