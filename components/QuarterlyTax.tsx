import Link from 'next/link';
import { Check, FileText, CheckCircle2 } from 'lucide-react';
import { formatMoney } from '@/lib/enums';
import { QUARTER_LABELS } from '@/lib/tax';
import { setQuarterlyFiling } from '@/app/actions';

export type QuarterData = {
  quarter: number;
  incomeCad: number; // taxable (QC/CA) income base, tax-inclusive
  overridden: boolean;
  gstCollected: number;
  qstCollected: number;
  gstPaid: number;
  qstPaid: number;
  gstNet: number;
  qstNet: number;
  gstReceived: boolean;
  qstReceived: boolean;
  filedAt: Date | null;
  filingLink: string | null;
  incomeOverrideCad: number | null;
};

function Row({ label, value, strong, tint }: { label: string; value: string; strong?: boolean; tint?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-slate-500 ${strong ? 'font-medium text-slate-700' : ''}`}>{label}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold' : ''} ${tint ?? 'text-slate-700'}`}>{value}</span>
    </div>
  );
}

export default function QuarterlyTax({
  year,
  years,
  quarters,
}: {
  year: number;
  years: number[];
  quarters: QuarterData[];
}) {
  const owed = quarters.reduce((s, q) => s + Math.max(q.gstNet + q.qstNet, 0), 0);
  const refund = quarters.reduce((s, q) => s + Math.max(-(q.gstNet + q.qstNet), 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">GST / QST remittance — {year}</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Tax backed out of received payments from Quebec &amp; Canadian clients, less GST/QST paid on expenses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {years.map((y) => (
            <Link
              key={y}
              href={`/finance?tab=tax&year=${y}`}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                y === year ? 'bg-brand text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Net owed to Revenu Québec — {year}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-rose-600">{formatMoney(owed, 'CAD')}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Net refund owed to you — {year}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-emerald-600">{formatMoney(refund, 'CAD')}</div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {quarters.map((q) => {
          const net = q.gstNet + q.qstNet;
          const filed = !!q.filingLink;
          return (
            <div
              key={q.quarter}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${filed ? 'border-emerald-200' : 'border-slate-200'}`}
            >
              <div className={`flex items-center justify-between border-b px-5 py-3 ${filed ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-100'}`}>
                <h3 className="text-sm font-semibold">{QUARTER_LABELS[q.quarter - 1]}</h3>
                {filed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 size={12} /> Filed
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Not filed</span>
                )}
              </div>

              <div className="space-y-3 px-5 py-4 text-sm">
                {/* Income + override */}
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <Row
                    label={`Taxable income (QC/CA)${q.overridden ? ' · override' : ''}`}
                    value={formatMoney(q.incomeCad, 'CAD')}
                    strong
                  />
                  <form action={setQuarterlyFiling} className="mt-2 flex items-center gap-1.5">
                    <input type="hidden" name="year" value={year} />
                    <input type="hidden" name="quarter" value={q.quarter} />
                    <input type="hidden" name="field" value="incomeOverride" />
                    <input
                      name="value"
                      type="number"
                      step="any"
                      min="0"
                      defaultValue={q.incomeOverrideCad ?? ''}
                      placeholder="Override income (CAD)"
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand focus:outline-none"
                    />
                    <button className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white">
                      Set
                    </button>
                  </form>
                </div>

                {/* GST */}
                <div className="space-y-1">
                  <Row label="GST collected (103)" value={formatMoney(q.gstCollected, 'CAD')} />
                  <Row label="GST paid (106)" value={`−${formatMoney(q.gstPaid, 'CAD')}`} />
                  <Row
                    label="GST net"
                    value={formatMoney(q.gstNet, 'CAD')}
                    strong
                    tint={q.gstNet >= 0 ? 'text-rose-600' : 'text-emerald-600'}
                  />
                  <form action={setQuarterlyFiling}>
                    <input type="hidden" name="year" value={year} />
                    <input type="hidden" name="quarter" value={q.quarter} />
                    <input type="hidden" name="field" value="gstReceived" />
                    <input type="hidden" name="value" value={q.gstReceived ? '0' : '1'} />
                    <button
                      className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition ${
                        q.gstReceived ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <Check size={11} /> {q.gstReceived ? 'GST received' : 'Mark GST received'}
                    </button>
                  </form>
                </div>

                {/* QST */}
                <div className="space-y-1 border-t border-slate-100 pt-3">
                  <Row label="QST collected (203)" value={formatMoney(q.qstCollected, 'CAD')} />
                  <Row label="QST paid (206)" value={`−${formatMoney(q.qstPaid, 'CAD')}`} />
                  <Row
                    label="QST net"
                    value={formatMoney(q.qstNet, 'CAD')}
                    strong
                    tint={q.qstNet >= 0 ? 'text-rose-600' : 'text-emerald-600'}
                  />
                  <form action={setQuarterlyFiling}>
                    <input type="hidden" name="year" value={year} />
                    <input type="hidden" name="quarter" value={q.quarter} />
                    <input type="hidden" name="field" value="qstReceived" />
                    <input type="hidden" name="value" value={q.qstReceived ? '0' : '1'} />
                    <button
                      className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition ${
                        q.qstReceived ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <Check size={11} /> {q.qstReceived ? 'QST received' : 'Mark QST received'}
                    </button>
                  </form>
                </div>

                {/* Net + filing */}
                <div className="flex items-center justify-between border-t-2 border-slate-200 pt-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {net >= 0 ? 'Total owed' : 'Total refund'}
                  </span>
                  <span className={`text-base font-bold tabular-nums ${net >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatMoney(Math.abs(net), 'CAD')}
                  </span>
                </div>

                <form action={setQuarterlyFiling} className="flex items-center gap-1.5">
                  <input type="hidden" name="year" value={year} />
                  <input type="hidden" name="quarter" value={q.quarter} />
                  <input type="hidden" name="field" value="filingLink" />
                  <FileText size={14} className="shrink-0 text-slate-400" />
                  <input
                    name="value"
                    defaultValue={q.filingLink ?? ''}
                    placeholder="Filed-return link (Google Drive…)"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand focus:outline-none"
                  />
                  <button className="shrink-0 rounded-md bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark">
                    Save
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        Box numbers (103/203 collected, 106/206 paid) match the Revenu Québec form. Only Quebec &amp; Canadian
        clients are treated as tax-inclusive; US/foreign payments are excluded. Set an override to enter a quarter's
        income manually.
      </p>
    </div>
  );
}
