import Link from 'next/link';
import { Fragment } from 'react';
import { ArrowLeft, Camera, FileText, Landmark, CreditCard, ChevronRight } from 'lucide-react';
import { getOptions } from '@/lib/options';
import { prisma } from '@/lib/prisma';
import FadeIn from '@/components/FadeIn';
import ImportUpload from '@/components/ImportUpload';

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

const SECTIONS = [
  { type: 'BANK', label: 'Bank account statements', Icon: Landmark },
  { type: 'CREDIT_CARD', label: 'Credit card statements', Icon: CreditCard },
];

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
      createdAt: p.createdAt,
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
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {SECTIONS.map((section, si) => {
            // Newest year first; within a year, Jan → Dec (unknown last), then by account.
            const rows = pending
              .filter((p) => p.accountType === section.type)
              .sort((a, b) => yearRank(b) - yearRank(a) || (a.month || 13) - (b.month || 13) || a.accountLabel.localeCompare(b.accountLabel));
            return (
              <FadeIn key={section.type} delay={0.06 + si * 0.04}>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                    <section.Icon size={16} className="text-slate-400" />
                    <h2 className="text-sm font-semibold">{section.label}</h2>
                    <span className="text-xs text-slate-400">· {rows.length}</span>
                  </div>
                  {rows.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-slate-400">None yet.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {rows.map((p, idx) => {
                        const showYear = p.year > 0 && (idx === 0 || rows[idx - 1].year !== p.year);
                        return (
                          <Fragment key={p.id}>
                            {showYear && (
                              <div className="bg-slate-50/70 px-5 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{p.year}</div>
                            )}
                            <Link href={`/finance/import/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50">
                              <div className="flex min-w-0 items-center gap-3">
                                <FileText size={16} className="shrink-0 text-slate-400" />
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-slate-800">{p.period || p.accountLabel}</div>
                                  <div className="truncate text-xs text-slate-400">{p.fileName}</div>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{p.count}</span>
                                <ChevronRight size={16} className="text-slate-300" />
                              </div>
                            </Link>
                          </Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
              </FadeIn>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Statements with no detectable year sort to the bottom.
function yearRank(p: { year: number }): number {
  return p.year || -1;
}
