// Pure, client-safe helpers for parsing bank / credit-card statements (CSV +
// the normalized PDF output) into reviewable lines. Shared by the import UI.

export type ImportLine = {
  include: boolean;
  type: 'expense' | 'income';
  title: string;
  category: string;
  amount: number; // positive
  date: string; // YYYY-MM-DD
  rawDesc: string;
  tax: 'none' | 'gst' | 'both'; // expense tax treatment; income is always 'none'
  clientId?: string | null; // income → assign to a client (becomes a payment)
  note?: string; // optional per-line note
};

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function pickDelim(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const counts: Record<string, number> = {
    ',': (line.match(/,/g) ?? []).length,
    ';': (line.match(/;/g) ?? []).length,
    '\t': (line.match(/\t/g) ?? []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ',';
}

export function parseCsv(text: string): string[][] {
  const delim = pickDelim(text);
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

export function num(s: string): number {
  if (!s) return 0;
  let t = s.trim();
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (/-\s*$/.test(t)) neg = true;
  t = t.replace(/[^0-9.-]/g, '');
  const v = parseFloat(t);
  if (Number.isNaN(v)) return 0;
  return neg ? -Math.abs(v) : v;
}

export function normalizeDate(s: string, order: 'MDY' | 'DMY'): string {
  const t = (s ?? '').trim();
  if (!t) return '';
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = `20${y}`;
    const mm = order === 'MDY' ? a : b;
    const dd = order === 'MDY' ? b : a;
    return `${y}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

const CAT_RULES: [RegExp, string][] = [
  [/interest/i, 'FEES'],
  [/\b(fee|charge|nsf|overdraft|service charge|atm|annual fee|late fee|finance charge)\b/i, 'FEES'],
  [/(\bgst\b|\bhst\b|\bqst\b|\bpst\b|\bvat\b|\btax\b|cra|revenue agency|irs)/i, 'TAXES'],
  [/(netflix|spotify|youtube|prime|disney|patreon|substack|subscription|membership|icloud|dropbox|1password|google one)/i, 'SUBSCRIPTION'],
  [/(aws|amazon web|google ?cloud|gcp|openai|anthropic|adobe|figma|notion|slack|microsoft|office ?365|github|gitlab|jetbrains|cursor|zoom|canva|airtable|zapier|atlassian|jira)/i, 'SOFTWARE'],
  [/(vercel|netlify|railway|heroku|digitalocean|cloudflare|hosting|domain|namecheap|godaddy|porkbun|squarespace|wix|wordpress|hostgator|bluehost)/i, 'HOSTING'],
  [/(hydro|electric|gas bill|water|internet|broadband|fibre|fiber|telus|bell|rogers|verizon|at&t|comcast|phone bill|mobile|wireless|utility|utilities)/i, 'UTILITIES'],
  [/(facebook|meta|google ads|adwords|linkedin|tiktok|twitter|\bads\b|marketing|mailchimp|hubspot|sendgrid|klaviyo|seo)/i, 'MARKETING'],
  [/(uber|lyft|taxi|airline|air canada|westjet|delta|united|flight|hotel|airbnb|expedia|booking\.com|rental car|train|via rail|parking|gas station|petro|shell|esso)/i, 'TRAVEL'],
  [/(restaurant|cafe|coffee|starbucks|tim hortons|mcdonald|uber eats|doordash|skip the dishes|grubhub|dining|bar &|catering|lunch|dinner)/i, 'MEALS'],
  [/(staples|office|wework|regus|rent|supplies|stationery)/i, 'OFFICE'],
  [/(upwork|fiverr|contractor|payroll|deel|gusto|freelanc|consult)/i, 'CONTRACTOR'],
  [/(apple store|best buy|equipment|hardware|laptop|monitor|keyboard|dell|lenovo|printer)/i, 'EQUIPMENT'],
];
export function guessCategory(desc: string): string {
  for (const [re, cat] of CAT_RULES) if (re.test(desc)) return cat;
  return 'OTHER';
}

export function detectHeaderIndex(rows: string[][]): number {
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const cells = rows[i].map((c) => c.toLowerCase());
    const hasDate = cells.some((c) => /date|posted/.test(c));
    const hasMoney = cells.some((c) => /amount|debit|credit|withdraw|deposit|value/.test(c));
    const hasDesc = cells.some((c) => /desc|narrat|detail|memo|payee|name|merchant|particular|transaction/.test(c));
    if (hasDate && (hasMoney || hasDesc)) return i;
  }
  return 0;
}

export type Mapping = {
  date: number;
  desc: number;
  mode: 'signed' | 'split';
  amount: number;
  debit: number;
  credit: number;
  expenseSign: 'neg' | 'pos';
  dateOrder: 'MDY' | 'DMY';
};

function findCol(header: string[], re: RegExp, fallback = -1): number {
  const i = header.findIndex((h) => re.test(h));
  return i >= 0 ? i : fallback;
}

export function detectMapping(header: string[]): Mapping {
  const date = findCol(header, /date|posted/i, 0);
  const debit = findCol(header, /debit|withdraw|money out|paid out|charge/i);
  const credit = findCol(header, /credit|deposit|money in|paid in/i);
  const amount = findCol(header, /amount|value/i, header.length - 1);
  const desc = findCol(header, /desc|narrat|detail|memo|payee|name|merchant|particular/i, 1);
  const mode: Mapping['mode'] = debit >= 0 ? 'split' : 'signed';
  return {
    date: date < 0 ? 0 : date,
    desc: desc < 0 ? 1 : desc,
    mode,
    amount: amount < 0 ? header.length - 1 : amount,
    debit: debit < 0 ? 0 : debit,
    credit: credit < 0 ? 0 : credit,
    expenseSign: 'neg',
    dateOrder: 'MDY',
  };
}

// Build reviewable lines from a normalized {date, desc, outflow, inflow, category}
// list, applying learned rules + defaults (interest→Interest expense, tax=both
// for expenses).
export function toLines(
  raw: { date: string; desc: string; outflow: number; inflow: number; category?: string }[],
  rulesByKey: Map<string, { type: string; category: string; title: string | null }>,
): ImportLine[] {
  return raw
    .map((b): ImportLine | null => {
      const amt = b.outflow || b.inflow;
      if (!amt) return null;
      const isExpense = b.outflow > 0;
      const interest = /interest/i.test(b.desc);
      const rule = rulesByKey.get(ruleKeyLocal(b.desc));
      const type: 'expense' | 'income' = (rule?.type as any) ?? (isExpense ? 'expense' : 'income');
      const title = rule?.title || (interest ? 'Interest expense' : b.desc || (isExpense ? 'Expense' : 'Income'));
      const category = rule?.category ?? (type === 'income' ? 'OTHER' : interest ? 'FEES' : b.category || guessCategory(b.desc));
      return {
        include: true,
        type,
        title,
        category,
        amount: Math.abs(amt),
        date: b.date,
        rawDesc: b.desc,
        tax: (type === 'expense' ? 'both' : 'none') as ImportLine['tax'],
        clientId: null,
      };
    })
    .filter((l): l is ImportLine => l !== null);
}

// Local copy of ruleKey to keep this module dependency-free.
function ruleKeyLocal(desc: string): string {
  return (desc || '').toUpperCase().replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).slice(0, 4).join(' ');
}
