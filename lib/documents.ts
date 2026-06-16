import { formatMoney } from '@/lib/enums';

function fmt(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toISOString().slice(0, 10);
}

type DocRow = { label: string; value: string };

function shell(
  heading: string,
  rows: DocRow[],
  amountLabel: string,
  amount: string,
  notes?: string | null,
  companyName = 'UA Agency',
) {
  return `
  <div style="font-family:Geist,Inter,system-ui,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #4f46e5;padding-bottom:16px;">
      <div style="font-size:20px;font-weight:700;">${companyName}</div>
      <div style="font-size:24px;font-weight:700;color:#4f46e5;">${heading}</div>
    </div>
    <table style="width:100%;margin-top:24px;border-collapse:collapse;font-size:14px;">
      ${rows
        .map(
          (r) =>
            `<tr><td style="padding:6px 0;color:#64748b;width:160px;">${r.label}</td><td style="padding:6px 0;font-weight:500;">${r.value}</td></tr>`,
        )
        .join('')}
    </table>
    <div style="margin-top:24px;background:#f8fafc;border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
      <span style="color:#64748b;font-size:13px;text-transform:uppercase;letter-spacing:.04em;">${amountLabel}</span>
      <span style="font-size:22px;font-weight:700;">${amount}</span>
    </div>
    ${notes ? `<p style="margin-top:20px;color:#475569;font-size:13px;white-space:pre-line;">${notes}</p>` : ''}
    <p style="margin-top:32px;color:#94a3b8;font-size:12px;">Thank you for working with ${companyName}.</p>
  </div>`;
}

export function invoiceHtml(o: {
  number: number;
  companyName: string;
  clientName: string;
  projectName?: string | null;
  currency: string;
  issuedAt: Date;
  dueAt?: Date | null;
  notes?: string | null;
  subtotal: number;
  gst: number;
  qst: number;
  total: number;
  gstRate: number;
  qstRate: number;
}) {
  const taxRows: DocRow[] = [];
  if (o.gst > 0) taxRows.push({ label: `GST (${o.gstRate}%)`, value: formatMoney(o.gst, o.currency) });
  if (o.qst > 0) taxRows.push({ label: `QST (${o.qstRate}%)`, value: formatMoney(o.qst, o.currency) });

  return shell(
    'INVOICE',
    [
      { label: 'Invoice #', value: String(o.number) },
      { label: 'Bill to', value: o.clientName },
      ...(o.projectName ? [{ label: 'Project', value: o.projectName }] : []),
      { label: 'Issued', value: fmt(o.issuedAt) },
      { label: 'Due', value: fmt(o.dueAt) },
      { label: 'Subtotal', value: formatMoney(o.subtotal, o.currency) },
      ...taxRows,
    ],
    'Total due',
    formatMoney(o.total, o.currency),
    o.notes,
    o.companyName,
  );
}

export function receiptHtml(o: {
  companyName: string;
  clientName: string;
  projectName?: string | null;
  amount: number;
  currency: string;
  paidAt: Date;
  method: string;
  note?: string | null;
}) {
  return shell(
    'RECEIPT',
    [
      { label: 'Received from', value: o.clientName },
      ...(o.projectName ? [{ label: 'Project', value: o.projectName }] : []),
      { label: 'Date', value: fmt(o.paidAt) },
      { label: 'Method', value: o.method },
    ],
    'Amount paid',
    formatMoney(o.amount, o.currency),
    o.note,
    o.companyName,
  );
}
