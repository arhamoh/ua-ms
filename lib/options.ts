import { prisma } from '@/lib/prisma';

export type Opt = { value: string; label: string; rate?: number | null };

export const OPTION_KINDS: { kind: string; label: string; hasRate?: boolean }[] = [
  { kind: 'projectType', label: 'Project types' },
  { kind: 'clientSource', label: 'Client sources' },
  { kind: 'expenseCategory', label: 'Expense categories' },
  { kind: 'fileCategory', label: 'File types' },
  { kind: 'paymentMethod', label: 'Payment methods' },
  { kind: 'currency', label: 'Currencies' },
  { kind: 'leadType', label: 'Lead types (commission %)', hasRate: true },
];

const cur = (c: string): Opt => ({ value: c, label: c });

export const DEFAULT_OPTIONS: Record<string, Opt[]> = {
  projectType: [
    { value: 'DESIGN', label: 'Design' },
    { value: 'DEVELOPMENT', label: 'Development' },
    { value: 'SOFTWARE', label: 'Software' },
  ],
  clientSource: [
    { value: 'UPWORK', label: 'Upwork' },
    { value: 'AGENCY', label: 'Agency' },
    { value: 'REFERRAL', label: 'Referral' },
    { value: 'OTHER', label: 'Other' },
  ],
  expenseCategory: [
    { value: 'SOFTWARE', label: 'Software' },
    { value: 'HOSTING', label: 'Hosting' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'OFFICE', label: 'Office' },
    { value: 'CONTRACTOR', label: 'Contractor' },
    { value: 'EQUIPMENT', label: 'Equipment' },
    { value: 'FEES', label: 'Fees' },
    { value: 'OTHER', label: 'Other' },
  ],
  fileCategory: [
    { value: 'LOGO', label: 'Logos' },
    { value: 'DESIGN', label: 'Designs' },
    { value: 'DOCUMENT', label: 'Documents' },
    { value: 'CONTRACT', label: 'Contracts' },
    { value: 'ASSET', label: 'Assets' },
    { value: 'OTHER', label: 'Other' },
  ],
  paymentMethod: [
    { value: 'BANK_TRANSFER', label: 'Bank transfer' },
    { value: 'CARD', label: 'Card' },
    { value: 'PAYPAL', label: 'PayPal' },
    { value: 'CASH', label: 'Cash' },
    { value: 'CRYPTO', label: 'Crypto' },
    { value: 'OTHER', label: 'Other' },
  ],
  currency: ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'PKR'].map(cur),
  leadType: [
    { value: 'INVITE', label: 'Invite', rate: 5 },
    { value: 'GENERATED', label: 'Generated lead', rate: 10 },
  ],
};

// Options for a kind — DB rows if any exist, otherwise the built-in defaults.
export async function getOptions(kind: string): Promise<Opt[]> {
  const rows = await prisma.optionItem.findMany({
    where: { kind },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });
  if (rows.length) return rows.map((r) => ({ value: r.value, label: r.label, rate: r.rate }));
  return DEFAULT_OPTIONS[kind] ?? [];
}

// Seed defaults into the DB once (only if the table is completely empty), so
// they become editable. Never re-seeds, so deletions stick.
export async function ensureOptionsSeeded() {
  const count = await prisma.optionItem.count();
  if (count > 0) return;
  const data = OPTION_KINDS.flatMap(({ kind }) =>
    (DEFAULT_OPTIONS[kind] ?? []).map((o, i) => ({
      kind,
      value: o.value,
      label: o.label,
      rate: o.rate ?? null,
      order: i,
    })),
  );
  if (data.length) await prisma.optionItem.createMany({ data, skipDuplicates: true });
}

export async function getLeadTypeRates(): Promise<Record<string, number>> {
  const opts = await getOptions('leadType');
  const m: Record<string, number> = {};
  for (const o of opts) if (o.rate != null) m[o.value] = o.rate;
  return m;
}
