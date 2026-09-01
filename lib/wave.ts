// Wave Accounting (waveapps.com) GraphQL client — reads businesses, invoices and
// their customers so invoices can be synced into the platform and matched to
// clients + payments. Auth: a full-access token generated in Wave's developer
// portal (https://developer.waveapps.com), set as WAVE_FULL_ACCESS_TOKEN.
// Note: Wave requires the connected business to be on a paid Wave Pro plan.

const ENDPOINT = 'https://gql.waveapps.com/graphql/public';

export function waveConfigured(): boolean {
  return Boolean(process.env.WAVE_FULL_ACCESS_TOKEN?.trim());
}

async function waveQuery<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = process.env.WAVE_FULL_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('Wave is not configured (WAVE_FULL_ACCESS_TOKEN).');
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 403) throw new Error('Wave rejected the token (401/403) — check it and that the business has Wave Pro.');
  if (!res.ok) throw new Error(`Wave API responded ${res.status}.`);
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('Wave returned an unreadable response.');
  if (Array.isArray(data.errors) && data.errors.length) throw new Error(data.errors[0]?.message || 'Wave API error.');
  return data.data as T;
}

export type WaveBusiness = { id: string; name: string };

export async function getWaveBusinesses(): Promise<WaveBusiness[]> {
  const d = await waveQuery<{ businesses: { edges: { node: WaveBusiness }[] } }>(
    `query { businesses(page: 1, pageSize: 50) { edges { node { id name } } } }`,
  );
  return (d?.businesses?.edges ?? []).map((e) => e.node).filter((n) => n?.id);
}

export type WaveInvoice = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  invoiceDate: string | null;
  dueDate: string | null;
  currency: string;
  total: number;
  amountDue: number;
  amountPaid: number;
  customerName: string | null;
  customerEmail: string | null;
};

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Pull every invoice for a business, following pagination.
export async function getWaveInvoices(businessId: string): Promise<WaveInvoice[]> {
  const out: WaveInvoice[] = [];
  const pageSize = 50;
  let page = 1;
  for (let guard = 0; guard < 500; guard++) {
    const d = await waveQuery<any>(
      `query($id: ID!, $page: Int!, $pageSize: Int!) {
        business(id: $id) {
          invoices(page: $page, pageSize: $pageSize) {
            pageInfo { currentPage totalPages totalCount }
            edges { node {
              id invoiceNumber status invoiceDate dueDate
              currency { code }
              total { value }
              amountDue { value }
              amountPaid { value }
              customer { name email }
            } }
          }
        }
      }`,
      { id: businessId, page, pageSize },
    );
    const conn = d?.business?.invoices;
    const edges = conn?.edges ?? [];
    for (const e of edges) {
      const n = e?.node;
      if (!n?.id) continue;
      out.push({
        id: n.id,
        invoiceNumber: n.invoiceNumber ?? null,
        status: String(n.status ?? ''),
        invoiceDate: n.invoiceDate ?? null,
        dueDate: n.dueDate ?? null,
        currency: n.currency?.code ?? 'CAD',
        total: num(n.total?.value),
        amountDue: num(n.amountDue?.value),
        amountPaid: num(n.amountPaid?.value),
        customerName: n.customer?.name ?? null,
        customerEmail: n.customer?.email ?? null,
      });
    }
    const pi = conn?.pageInfo;
    if (!pi || edges.length === 0 || pi.currentPage >= pi.totalPages) break;
    page++;
  }
  return out;
}

// Map Wave's invoice status enum to our InvoiceStatus.
export function mapWaveStatus(s: string): 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'VOID' {
  const u = (s || '').toUpperCase();
  if (u === 'PAID') return 'PAID';
  if (u === 'PARTIAL') return 'PARTIAL';
  if (u === 'DRAFT' || u === 'SAVED' || u === 'UNSENT') return 'DRAFT';
  return 'SENT'; // SENT, VIEWED, OVERDUE, UNPAID, …
}

export async function testWave(): Promise<{ ok: boolean; message: string }> {
  if (!waveConfigured()) return { ok: false, message: 'No Wave token set (WAVE_FULL_ACCESS_TOKEN).' };
  try {
    const biz = await getWaveBusinesses();
    if (!biz.length) return { ok: false, message: 'Token valid but no businesses found — confirm the account has Wave Pro.' };
    const names = biz.map((b) => b.name).slice(0, 3).join(', ');
    return { ok: true, message: `Connected — ${biz.length} business${biz.length === 1 ? '' : 'es'}: ${names}.` };
  } catch (e: any) {
    return { ok: false, message: e?.message?.slice(0, 200) ?? 'Connection failed.' };
  }
}
