import { prisma } from '@/lib/prisma';

export type Company = {
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  gstNumber: string | null;
  qstNumber: string | null;
  neqNumber: string | null;
  gstRate: number;
  qstRate: number;
};

const DEFAULT_COMPANY: Company = {
  name: 'UA Agency',
  email: null,
  phone: null,
  website: null,
  address: null,
  gstNumber: null,
  qstNumber: null,
  neqNumber: null,
  gstRate: 5,
  qstRate: 9.975,
};

export async function getCompany(): Promise<Company> {
  const c = await prisma.companySetting.findUnique({ where: { id: 'default' } });
  if (!c) return DEFAULT_COMPANY;
  return {
    name: c.name,
    email: c.email,
    phone: c.phone,
    website: c.website,
    address: c.address,
    gstNumber: c.gstNumber,
    qstNumber: c.qstNumber,
    neqNumber: c.neqNumber,
    gstRate: c.gstRate,
    qstRate: c.qstRate,
  };
}

export const TAX_REGIONS = [
  { value: 'QC', label: 'Quebec (GST + QST)' },
  { value: 'CA', label: 'Canada — other province (GST)' },
  { value: 'US', label: 'United States (no tax)' },
];
export const TAX_REGION_LABELS: Record<string, string> = Object.fromEntries(
  TAX_REGIONS.map((r) => [r.value, r.label]),
);

// GST applies in Quebec + rest of Canada; QST only in Quebec; none elsewhere.
export function computeTax(amount: number, taxRegion: string | null, company: Company) {
  const gst = taxRegion === 'QC' || taxRegion === 'CA' ? amount * (company.gstRate / 100) : 0;
  const qst = taxRegion === 'QC' ? amount * (company.qstRate / 100) : 0;
  return { subtotal: amount, gst, qst, total: amount + gst + qst };
}
