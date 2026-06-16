// Live foreign-exchange helpers — converts any currency to CAD.
// Uses Frankfurter (ECB data, free, no API key). Cached ~1h via fetch revalidate.

export type Rates = Record<string, number>; // currency -> multiplier to CAD

export async function getRatesToCad(): Promise<Rates> {
  const rates: Rates = { CAD: 1 };
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=CAD', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`fx ${res.status}`);
    const data = (await res.json()) as { rates?: Record<string, number> };
    for (const [cur, perCad] of Object.entries(data.rates ?? {})) {
      // perCad = how many `cur` per 1 CAD → 1 `cur` = 1/perCad CAD
      if (typeof perCad === 'number' && perCad > 0) rates[cur] = 1 / perCad;
    }
  } catch {
    // Network/API failure: only CAD is known; other currencies pass through.
  }
  return rates;
}

// Convert an amount in `currency` to CAD using the given rate table.
// Unknown currencies pass through unchanged (best effort).
export function toCad(amount: number, currency: string | null | undefined, rates: Rates): number {
  const cur = currency ?? 'CAD';
  const r = rates[cur];
  return r != null ? amount * r : amount;
}
