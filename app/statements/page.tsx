import { Fragment } from 'react';
import { Landmark, CreditCard, Upload, FileText, Download } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { saveStatement, deleteStatement } from '@/app/actions';
import { STATEMENT_ACCOUNT_TYPES, STATEMENT_ACCOUNT_TYPE_LABELS, STATEMENT_ACCOUNT_TYPE_BADGE } from '@/lib/enums';
import FadeIn from '@/components/FadeIn';
import RowActions from '@/components/RowActions';
import Pill from '@/components/Pill';
import AnimatedButton from '@/components/AnimatedButton';

export const dynamic = 'force-dynamic';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

function humanSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// The statement's year — read from the free-text period ("June 2026") when it
// carries one, otherwise the date it was added.
function yearOf(s: { periodLabel: string | null; createdAt: Date }): number {
  const m = s.periodLabel?.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : s.createdAt.getUTCFullYear();
}

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// The statement's month (1–12) parsed from the free-text period. Handles month
// names/abbreviations ("January", "Jan") and plain numbers ("1", "01", "06/2026").
// Returns 0 when no month can be determined (those sort last within a year).
function monthOf(period: string | null): number {
  if (!period) return 0;
  const s = period.toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (new RegExp(`\\b${MONTH_NAMES[i]}`).test(s)) return i + 1;
  }
  // Strip any 4-digit year first so "06/2026" doesn't read the year as a month.
  const noYear = s.replace(/\b(19|20)\d{2}\b/g, ' ');
  const m = noYear.match(/\b(0?[1-9]|1[0-2])\b/);
  return m ? Number(m[1]) : 0;
}

export default async function StatementsPage() {
  const statements = await prisma.statement.findMany({
    orderBy: [{ accountLabel: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true, accountType: true, accountLabel: true, fileName: true, mimeType: true,
      size: true, periodLabel: true, source: true, importedExpenses: true, importedIncome: true,
      createdAt: true, uploadedBy: { select: { name: true } },
    },
  });

  const byType = (t: string) => statements.filter((s) => s.accountType === t);
  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      <FadeIn>
        <h1 className="text-2xl font-bold tracking-tight">Statements</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your archived bank &amp; credit-card statements. Statements you import are saved here automatically; you can
          also upload one on its own. Open any to view it.
        </p>
      </FadeIn>

      {/* Upload */}
      <FadeIn delay={0.05}>
        <form action={saveStatement} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Upload size={16} className="text-brand" /> Upload statements</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Type</span>
              <select name="accountType" defaultValue="BANK" className={inputCls}>
                {STATEMENT_ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{STATEMENT_ACCOUNT_TYPE_LABELS[t]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Account *</span>
              <input name="accountLabel" required className={inputCls} placeholder="Scotiabank chequing" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Period (optional)</span>
              <input name="periodLabel" className={inputCls} placeholder="June 2026" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Files * (PDF or CSV)</span>
              <input name="file" type="file" multiple accept=".pdf,application/pdf,.csv,text/csv" required className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white" />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">Pick one or several files. With multiple, the month/year is read from each filename (max 15 MB each).</span>
            <AnimatedButton className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">Save statements</AnimatedButton>
          </div>
        </form>
      </FadeIn>

      {statements.length === 0 ? (
        <FadeIn delay={0.1}>
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-sm text-slate-500">
            No statements yet. Upload one above, or import a statement from Finance → Expenses.
          </div>
        </FadeIn>
      ) : (
        STATEMENT_ACCOUNT_TYPES.map((type, ti) => {
          // Newest year first; within a year, months run Jan → Dec (unknown
          // months last), then by account name.
          const rows = byType(type)
            .slice()
            .sort((a, b) => {
              const ma = monthOf(a.periodLabel) || 13;
              const mb = monthOf(b.periodLabel) || 13;
              return (
                yearOf(b) - yearOf(a) ||
                ma - mb ||
                a.accountLabel.localeCompare(b.accountLabel) ||
                b.createdAt.getTime() - a.createdAt.getTime()
              );
            });
          if (rows.length === 0) return null;
          const Icon = type === 'CREDIT_CARD' ? CreditCard : Landmark;
          return (
            <FadeIn key={type} delay={0.1 + ti * 0.05}>
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                  <Icon size={16} className="text-slate-400" />
                  <h2 className="text-sm font-semibold">{STATEMENT_ACCOUNT_TYPE_LABELS[type]}s</h2>
                  <span className="text-xs text-slate-400">· {rows.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Account</th>
                        <th className="px-5 py-3 font-medium">Period</th>
                        <th className="px-5 py-3 font-medium">File</th>
                        <th className="px-5 py-3 font-medium">Added</th>
                        <th className="px-5 py-3 font-medium">Source</th>
                        <th className="px-5 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((s, idx) => {
                        const yr = yearOf(s);
                        const showYear = idx === 0 || yearOf(rows[idx - 1]) !== yr;
                        return (
                        <Fragment key={s.id}>
                          {showYear && (
                            <tr className="bg-slate-50/70">
                              <td colSpan={6} className="px-5 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{yr}</td>
                            </tr>
                          )}
                        <tr className="hover:bg-slate-50">
                          <td className="px-5 py-3">
                            <div className="font-medium text-slate-800">{s.accountLabel}</div>
                            <Pill className={STATEMENT_ACCOUNT_TYPE_BADGE[s.accountType] ?? 'bg-slate-100 text-slate-500'}>{STATEMENT_ACCOUNT_TYPE_LABELS[s.accountType] ?? s.accountType}</Pill>
                          </td>
                          <td className="px-5 py-3 text-slate-500">{s.periodLabel || '—'}</td>
                          <td className="px-5 py-3">
                            <a href={`/api/statements/${s.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline">
                              <FileText size={14} /> {s.fileName}
                            </a>
                            <div className="text-xs text-slate-400">{humanSize(s.size)}</div>
                          </td>
                          <td className="px-5 py-3 tabular-nums text-slate-500">
                            {s.createdAt.toISOString().slice(0, 10)}
                            {s.uploadedBy?.name && <div className="text-xs text-slate-400">by {s.uploadedBy.name}</div>}
                          </td>
                          <td className="px-5 py-3">
                            {s.source === 'IMPORT' ? (
                              <span className="text-xs text-slate-500">
                                Imported
                                {(s.importedExpenses + s.importedIncome) > 0 && (
                                  <span className="text-slate-400"> · {s.importedExpenses} exp{s.importedIncome ? `, ${s.importedIncome} inc` : ''}</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Uploaded</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <a href={`/api/statements/${s.id}?dl=1`} title="Download" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand">
                                <Download size={15} />
                              </a>
                              <RowActions deleteAction={deleteStatement.bind(null, s.id)} label="statement" />
                            </div>
                          </td>
                        </tr>
                        </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </FadeIn>
          );
        })
      )}
    </div>
  );
}
