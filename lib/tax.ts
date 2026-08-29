import type { Company } from '@/lib/company';

// ─── GST/QST helpers ─────────────────────────────────────────────────────────
//
// Two directions of the same rates live here:
//   • computeTax (lib/company.ts) ADDS tax on top of an invoice subtotal.
//   • backOutTax (here) removes tax that is already baked into a total — a
//     received payment, or a taxable expense total off a receipt.

// Which taxes a client of a given region was charged (mirrors computeTax()).
export function taxesForRegion(region: string | null): { gst: boolean; qst: boolean } {
  return { gst: region === 'QC' || region === 'CA', qst: region === 'QC' };
}

// Back GST/QST out of a tax-INCLUSIVE total.
//   base = total / (1 + gst% + qst%)
// Returns the tax-exclusive subtotal plus each tax portion, in the same
// currency as `total`.
export function backOutTax(
  total: number,
  opts: { gst: boolean; qst: boolean; company: Pick<Company, 'gstRate' | 'qstRate'> },
): { subtotal: number; gst: number; qst: number } {
  const g = opts.gst ? opts.company.gstRate / 100 : 0;
  const q = opts.qst ? opts.company.qstRate / 100 : 0;
  const divisor = 1 + g + q;
  if (!Number.isFinite(total) || divisor <= 0) return { subtotal: total, gst: 0, qst: 0 };
  const subtotal = total / divisor;
  return { subtotal, gst: subtotal * g, qst: subtotal * q };
}

// Convenience for a taxable Canadian expense total (GST + QST both baked in).
export function backOutExpenseTax(total: number, company: Pick<Company, 'gstRate' | 'qstRate'>) {
  return backOutTax(total, { gst: true, qst: true, company });
}

// GST/QST embedded in a received payment, based on the paying client's region.
// US / foreign clients (no GST/QST charged) return zeros.
export function collectedFromPayment(
  amountCad: number,
  region: string | null,
  company: Pick<Company, 'gstRate' | 'qstRate'>,
) {
  const t = taxesForRegion(region);
  const { gst, qst } = backOutTax(amountCad, { gst: t.gst, qst: t.qst, company });
  return { gst, qst };
}

// Calendar-quarter [start, end) in UTC for a given year + quarter (1..4).
export function quarterRange(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  return {
    start: new Date(Date.UTC(year, startMonth, 1)),
    end: new Date(Date.UTC(year, startMonth + 3, 1)),
  };
}

export const QUARTER_LABELS = ['Q1 · Jan–Mar', 'Q2 · Apr–Jun', 'Q3 · Jul–Sep', 'Q4 · Oct–Dec'];
