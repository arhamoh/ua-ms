import { formatMoney } from '@/lib/enums';

const AGENCY = 'UA Agency';

function fmt(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toISOString().slice(0, 10);
}

type DocRow = { label: string; value: string };

function shell(title: string, heading: string, rows: DocRow[], amountLabel: string, amount: string, notes?: string | null) {
  return `
  <div style="font-family:Geist,Inter,system-ui,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #4f46e5;padding-bottom:16px;">
      <div style="font-size:20px;font-weight:700;">${AGENCY}</div>
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
    <p style="margin-top:32px;color:#94a3b8;font-size:12px;">Thank you for working with ${AGENCY}.</p>
  </div>`;
}

export function invoiceHtml(o: {
  number: number;
  clientName: string;
  projectName?: string | null;
  amount: number;
  currency: string;
  issuedAt: Date;
  dueAt?: Date | null;
  notes?: string | null;
}) {
  return shell(
    `Invoice #${o.number}`,
    'INVOICE',
    [
      { label: 'Invoice #', value: String(o.number) },
      { label: 'Bill to', value: o.clientName },
      ...(o.projectName ? [{ label: 'Project', value: o.projectName }] : []),
      { label: 'Issued', value: fmt(o.issuedAt) },
      { label: 'Due', value: fmt(o.dueAt) },
    ],
    'Amount due',
    formatMoney(o.amount, o.currency),
    o.notes,
  );
}

export function receiptHtml(o: {
  clientName: string;
  projectName?: string | null;
  amount: number;
  currency: string;
  paidAt: Date;
  method: string;
  note?: string | null;
}) {
  return shell(
    'Receipt',
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
  );
}
