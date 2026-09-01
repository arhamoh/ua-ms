// Builds audit-ready finance reports from resolved ledger entries.
// Pure: the caller loads/normalizes entries (amounts already in CAD), these
// functions shape them into a titled table + totals, plus a CSV serializer.

export type LedgerEntry = {
  date: string; // YYYY-MM-DD
  kind: 'income' | 'expense';
  description: string;
  party: string; // client / vendor / category
  amountCad: number;
  gst: number;
  qst: number;
};

export type ReportType =
  | 'top_purchases'
  | 'top_sales'
  | 'gst_collected'
  | 'gst_paid'
  | 'general_ledger';

export const REPORT_TYPES: { value: ReportType; label: string; hasTopN?: boolean }[] = [
  { value: 'top_purchases', label: 'Top purchases (highest expenses)', hasTopN: true },
  { value: 'top_sales', label: 'Top sales (highest income)', hasTopN: true },
  { value: 'gst_collected', label: 'GST/QST collected ledger (income)' },
  { value: 'gst_paid', label: 'GST/QST paid ledger (expenses / ITCs)' },
  { value: 'general_ledger', label: 'General ledger (all transactions)' },
];

export const REPORT_LABELS: Record<ReportType, string> = Object.fromEntries(
  REPORT_TYPES.map((r) => [r.value, r.label]),
) as Record<ReportType, string>;

export type Cell = string | number;
export type Column = { label: string; money?: boolean };
export type BuiltReport = {
  type: ReportType;
  title: string;
  columns: Column[];
  rows: Cell[][];
  totals?: Cell[];
  notes?: string[];
};

const money2 = (n: number) => Math.round(n * 100) / 100;
const sum = (arr: LedgerEntry[], sel: (e: LedgerEntry) => number) => money2(arr.reduce((s, e) => s + sel(e), 0));

export function buildReport(
  type: ReportType,
  entries: LedgerEntry[],
  opts: { topN?: number } = {},
): BuiltReport {
  const income = entries.filter((e) => e.kind === 'income');
  const expense = entries.filter((e) => e.kind === 'expense');
  const topN = Math.max(1, Math.min(100, opts.topN ?? 5));

  if (type === 'top_purchases') {
    const rows = [...expense].sort((a, b) => b.amountCad - a.amountCad).slice(0, topN);
    return {
      type,
      title: `Top ${rows.length} purchases (highest expenses)`,
      columns: [{ label: 'Date' }, { label: 'Description' }, { label: 'Category' }, { label: 'Amount (CAD)', money: true }, { label: 'GST', money: true }, { label: 'QST', money: true }],
      rows: rows.map((e) => [e.date, e.description, e.party, money2(e.amountCad), money2(e.gst), money2(e.qst)]),
      totals: ['', 'Total', '', sum(rows, (e) => e.amountCad), sum(rows, (e) => e.gst), sum(rows, (e) => e.qst)],
    };
  }

  if (type === 'top_sales') {
    const rows = [...income].sort((a, b) => b.amountCad - a.amountCad).slice(0, topN);
    return {
      type,
      title: `Top ${rows.length} sales (highest income)`,
      columns: [{ label: 'Date' }, { label: 'Description' }, { label: 'Client / source' }, { label: 'Amount (CAD)', money: true }, { label: 'GST', money: true }, { label: 'QST', money: true }],
      rows: rows.map((e) => [e.date, e.description, e.party, money2(e.amountCad), money2(e.gst), money2(e.qst)]),
      totals: ['', 'Total', '', sum(rows, (e) => e.amountCad), sum(rows, (e) => e.gst), sum(rows, (e) => e.qst)],
    };
  }

  if (type === 'gst_collected') {
    const rows = income;
    return {
      type,
      title: 'GST/QST collected — income ledger',
      columns: [{ label: 'Date' }, { label: 'Description' }, { label: 'Client / source' }, { label: 'Amount (CAD)', money: true }, { label: 'GST collected', money: true }, { label: 'QST collected', money: true }],
      rows: rows.map((e) => [e.date, e.description, e.party, money2(e.amountCad), money2(e.gst), money2(e.qst)]),
      totals: ['', `${rows.length} line${rows.length === 1 ? '' : 's'}`, '', sum(rows, (e) => e.amountCad), sum(rows, (e) => e.gst), sum(rows, (e) => e.qst)],
    };
  }

  if (type === 'gst_paid') {
    const rows = expense;
    return {
      type,
      title: 'GST/QST paid (input tax credits) — expense ledger',
      columns: [{ label: 'Date' }, { label: 'Description' }, { label: 'Category' }, { label: 'Amount (CAD)', money: true }, { label: 'GST paid', money: true }, { label: 'QST paid', money: true }],
      rows: rows.map((e) => [e.date, e.description, e.party, money2(e.amountCad), money2(e.gst), money2(e.qst)]),
      totals: ['', `${rows.length} line${rows.length === 1 ? '' : 's'}`, '', sum(rows, (e) => e.amountCad), sum(rows, (e) => e.gst), sum(rows, (e) => e.qst)],
    };
  }

  // general_ledger
  const rows = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const incTotal = sum(income, (e) => e.amountCad);
  const expTotal = sum(expense, (e) => e.amountCad);
  return {
    type,
    title: 'General ledger — all transactions',
    columns: [{ label: 'Date' }, { label: 'Type' }, { label: 'Description' }, { label: 'Party' }, { label: 'Amount (CAD)', money: true }, { label: 'GST', money: true }, { label: 'QST', money: true }],
    rows: rows.map((e) => [e.date, e.kind === 'income' ? 'Income' : 'Expense', e.description, e.party, money2(e.amountCad), money2(e.gst), money2(e.qst)]),
    notes: [
      `Income total: ${incTotal.toFixed(2)} CAD  ·  GST collected: ${sum(income, (e) => e.gst).toFixed(2)}  ·  QST collected: ${sum(income, (e) => e.qst).toFixed(2)}`,
      `Expense total: ${expTotal.toFixed(2)} CAD  ·  GST paid: ${sum(expense, (e) => e.gst).toFixed(2)}  ·  QST paid: ${sum(expense, (e) => e.qst).toFixed(2)}`,
      `Net (income − expenses): ${money2(incTotal - expTotal).toFixed(2)} CAD`,
    ],
  };
}

export function reportToCsv(r: BuiltReport): string {
  const esc = (v: Cell): string => {
    const s = typeof v === 'number' ? v.toFixed(2) : String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out: string[] = [];
  out.push(r.columns.map((c) => esc(c.label)).join(','));
  for (const row of r.rows) out.push(row.map(esc).join(','));
  if (r.totals) out.push(r.totals.map(esc).join(','));
  if (r.notes?.length) { out.push(''); for (const n of r.notes) out.push(esc(n)); }
  return out.join('\r\n');
}
