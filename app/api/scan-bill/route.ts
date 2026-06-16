import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CATS = [
  'SOFTWARE', 'SUBSCRIPTION', 'HOSTING', 'UTILITIES', 'MARKETING', 'OFFICE',
  'TRAVEL', 'MEALS', 'CONTRACTOR', 'EQUIPMENT', 'FEES', 'TAXES', 'OTHER',
];

function extractJson(s: string): any | null {
  if (!s) return null;
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: 'not_configured' });

  let image: string | undefined;
  try {
    const body = await req.json();
    image = typeof body.image === 'string' ? body.image : undefined;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!image || !image.startsWith('data:image')) {
    return NextResponse.json({ error: 'no_image' }, { status: 400 });
  }

  const prompt = `You read bills, invoices and receipts (any country, any language). Extract from this image:
- vendor: the biller / merchant / company name (short)
- amount: the TOTAL amount payable, as a plain number only (no currency symbol, no thousands separators)
- currency: the ISO 4217 code shown on the bill (e.g. PKR, CAD, USD, EUR, GBP). If it shows Rs / Rupees, use PKR.
- date: the bill or due date as YYYY-MM-DD (best guess if ambiguous)
- category: choose ONE of ${CATS.join(', ')}
- summary: a 3-6 word description of what this bill is for
Reply with ONLY a JSON object: {"vendor":"","amount":0,"currency":"","date":"","category":"","summary":""}. No other text.`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'UA Agency Platform',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_VISION_MODEL || 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
        max_tokens: 400,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: 'upstream', detail: `${res.status} ${t.slice(0, 180)}` });
    }

    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    const parsed = extractJson(content);
    if (!parsed) return NextResponse.json({ error: 'parse', detail: content.slice(0, 200) });

    const rawCat = String(parsed.category ?? '').toUpperCase();
    const out = {
      vendor: String(parsed.vendor ?? '').slice(0, 120),
      amount: Number(String(parsed.amount ?? '').replace(/[^0-9.]/g, '')) || 0,
      currency: typeof parsed.currency === 'string' ? parsed.currency.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) : '',
      date: typeof parsed.date === 'string' ? parsed.date.slice(0, 10) : '',
      category: CATS.includes(rawCat) ? rawCat : 'OTHER',
      summary: String(parsed.summary ?? '').slice(0, 120),
    };
    return NextResponse.json({ ok: true, data: out });
  } catch (e: any) {
    return NextResponse.json({ error: 'failed', detail: e?.message ?? 'unknown' });
  }
}
