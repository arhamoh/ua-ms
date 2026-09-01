import Link from 'next/link';
import { ArrowLeft, Camera } from 'lucide-react';
import { getOptions } from '@/lib/options';
import { prisma } from '@/lib/prisma';
import FadeIn from '@/components/FadeIn';
import ImportUpload from '@/components/ImportUpload';
import PendingImportsBoard from '@/components/PendingImportsBoard';

export const dynamic = 'force-dynamic';

const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Year / month parsed from a statement's filename ("April 2025 e-statement.pdf").
function yearOf(name: string): number {
  const m = name.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : 0;
}
function monthOf(name: string): number {
  const s = name.toLowerCase();
  for (let i = 0; i < 12; i++) if (new RegExp(`\\b${MONTH_ABBR[i]}`).test(s)) return i + 1;
  const noYear = s.replace(/\b(19|20)\d{2}\b/g, ' ');
  const m = noYear.match(/\b(0?[1-9]|1[0-2])\b/);
  return m ? Number(m[1]) : 0;
}
function periodLabel(name: string): string {
  const y = yearOf(name);
  const mo = monthOf(name);
  if (mo && y) return `${MONTH_FULL[mo - 1]} ${y}`;
  if (y) return String(y);
  return '';
}

export default async function ImportStatementPage() {
  const [currencies, rules, pendingRaw] = await Promise.all([
    getOptions('currency'),
    prisma.txnRule.findMany({ orderBy: { hits: 'desc' }, select: { matchKey: true, type: true, category: true, title: true } }),
    prisma.pendingImport.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, fileName: true, accountType: true, accountLabel: true, currency: true, createdAt: true, lines: true },
    }),
  ]);

  const pending = pendingRaw.map((p) => {
    const lines = (p.lines as any[]) ?? [];
    const count = lines.filter((l) => l?.include && Number(l?.amount) > 0).length;
    return {
      id: p.id, fileName: p.fileName, accountType: p.accountType, accountLabel: p.accountLabel,
      count, year: yearOf(p.fileName), month: monthOf(p.fileName), period: periodLabel(p.fileName),
    };
  });

  return (
    <div>
      <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700">
        <ArrowLeft size={14} /> Finance
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import statement</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload one or several statements — each is saved as a pending import you can review in its own tab and finish later.
          </p>
        </div>
        <Link href="/finance/bill" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-brand">
          <Camera size={15} /> Scan a single bill instead
        </Link>
      </div>

      <FadeIn><ImportUpload currencies={currencies} rules={rules} /></FadeIn>

      {pending.length > 0 && (
        <FadeIn delay={0.06}>
          <div className="mt-6">
            <p className="mb-3 text-xs text-slate-400">Drag a statement between sections, or use the chip, to change its type.</p>
            <PendingImportsBoard pending={pending} />
          </div>
        </FadeIn>
      )}
    </div>
  );
}
