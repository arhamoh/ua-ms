import Link from 'next/link';
import { TrendingUp, TrendingDown, Scale, Plus, Landmark, RotateCcw, HandCoins, Upload } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import {
  addExpense,
  setSalary,
  recordSalaryPayment,
  deleteExpense,
  deleteSalaryPayment,
  toggleExpenseReimbursed,
  addLoan,
  recordLoanRecovery,
  deleteLoan,
} from '@/app/actions';
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_BADGE, formatMoney } from '@/lib/enums';
import { getOptions, ensureExpenseCategories } from '@/lib/options';
import { getRatesToCad, toCad } from '@/lib/fx';
import FadeIn from '@/components/FadeIn';
import RowActions from '@/components/RowActions';
import Pill from '@/components/Pill';
import AnimatedButton from '@/components/AnimatedButton';

export const dynamic = 'force-dynamic';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

const pad = (n: number) => String(n).padStart(2, '0');

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const tab = ['expenses', 'salaries', 'loans'].includes(sp.tab ?? '') ? sp.tab! : 'pnl';

  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : defaultMonth;
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const monthLabel = start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const today = now.toISOString().split('T')[0];

  await ensureExpenseCategories();
  const [rates, payments, expenses, salaryPays, commPays, users, expenseCats, currencies, loans, owedExpenses] =
    await Promise.all([
      getRatesToCad(),
      prisma.payment.findMany({ where: { paidAt: { gte: start, lt: end } } }),
      prisma.expense.findMany({
        where: { date: { gte: start, lt: end } },
        orderBy: { date: 'desc' },
        include: { paidBy: { select: { name: true } } },
      }),
      prisma.salaryPayment.findMany({ where: { paidAt: { gte: start, lt: end } }, include: { user: true }, orderBy: { paidAt: 'desc' } }),
      prisma.commissionPayout.findMany({ where: { paidAt: { gte: start, lt: end } } }),
      prisma.user.findMany({ orderBy: { name: 'asc' }, include: { salaries: { orderBy: { effectiveFrom: 'desc' }, take: 1 } } }),
      getOptions('expenseCategory'),
      getOptions('currency'),
      prisma.loan.findMany({ orderBy: { givenAt: 'desc' } }),
      // Reimbursements still owed to team members — across all time, not just this month.
      prisma.expense.findMany({
        where: { paidById: { not: null }, reimbursed: false },
        include: { paidBy: { select: { name: true } } },
      }),
    ]);

  const cadOf = (amt: number, cur: string) => toCad(amt, cur, rates);

  // Loans ledger (all in CAD).
  const loanGiven = loans.reduce((s, l) => s + (l.amountCad ?? cadOf(l.amount, l.currency)), 0);
  const loanRecovered = loans.reduce((s, l) => s + l.recoveredAmount, 0);
  const loanOutstanding = loanGiven - loanRecovered;

  // Total still owed back to people who fronted expenses.
  const owedTotal = owedExpenses.reduce((s, e) => s + (e.amountCad ?? cadOf(e.amount, e.currency)), 0);

  const income = payments.reduce((s, p) => s + (p.amountCad ?? cadOf(p.amount, p.currency)), 0);
  const expenseTotal = expenses.reduce((s, e) => s + (e.amountCad ?? cadOf(e.amount, e.currency)), 0);
  const salaryTotal = salaryPays.reduce((s, p) => s + (p.amountCad ?? cadOf(p.amount, p.currency)), 0);
  const commTotal = commPays.reduce((s, p) => s + p.amount, 0);
  const outgoings = expenseTotal + salaryTotal + commTotal;
  const net = income - outgoings;

  const byCategory: Record<string, number> = {};
  expenses.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + (e.amountCad ?? cadOf(e.amount, e.currency));
  });

  const tabCls = (active: boolean) =>
    `border-b-2 px-1 pb-2 text-sm font-medium transition ${
      active ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
    }`;
  const tabHref = (t: string) => `/finance?tab=${t}&month=${month}`;

  return (
    <div>
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
            <p className="mt-1 text-sm text-slate-500">Income, expenses, salaries — all in CAD.</p>
          </div>
          <form className="flex items-end gap-2">
            <input type="hidden" name="tab" value={tab} />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Month</span>
              <input type="month" name="month" defaultValue={month} className={inputCls} />
            </label>
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">Go</button>
          </form>
        </div>
      </FadeIn>

      <div className="mb-6 mt-4 flex gap-6 border-b border-slate-200">
        <Link href={tabHref('pnl')} className={tabCls(tab === 'pnl')}>P&amp;L</Link>
        <Link href={tabHref('expenses')} className={tabCls(tab === 'expenses')}>Expenses</Link>
        <Link href={tabHref('salaries')} className={tabCls(tab === 'salaries')}>Salaries</Link>
        <Link href={tabHref('loans')} className={tabCls(tab === 'loans')}>Loans</Link>
      </div>

      {tab === 'pnl' && (
        <div>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: `Income — ${monthLabel}`, value: formatMoney(income, 'CAD'), icon: TrendingUp, tint: 'bg-emerald-50 text-emerald-600' },
              { label: 'Expenses', value: formatMoney(outgoings, 'CAD'), icon: TrendingDown, tint: 'bg-rose-50 text-rose-600' },
              { label: 'Net', value: formatMoney(net, 'CAD'), icon: Scale, tint: net >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600' },
            ].map((s, i) => (
              <FadeIn key={s.label} delay={0.04 * i}>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${s.tint}`}><s.icon size={20} /></span>
                  <div className="mt-4 text-2xl font-semibold tracking-tight">{s.value}</div>
                  <div className="mt-0.5 text-sm text-slate-500">{s.label}</div>
                </div>
              </FadeIn>
            ))}
          </section>

          <FadeIn delay={0.1}>
            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold">Breakdown — {monthLabel}</h2></div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-emerald-50/40">
                    <td className="px-5 py-3 font-medium text-emerald-700">Client payments received</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-emerald-700">{formatMoney(income, 'CAD')}</td>
                  </tr>
                  {Object.keys(EXPENSE_CATEGORY_LABELS).map((cat) =>
                    byCategory[cat] ? (
                      <tr key={cat}>
                        <td className="px-5 py-3 text-slate-600">Expense · {EXPENSE_CATEGORY_LABELS[cat]}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-600">−{formatMoney(byCategory[cat], 'CAD')}</td>
                      </tr>
                    ) : null,
                  )}
                  {salaryTotal > 0 && (
                    <tr><td className="px-5 py-3 text-slate-600">Salaries paid</td><td className="px-5 py-3 text-right tabular-nums text-slate-600">−{formatMoney(salaryTotal, 'CAD')}</td></tr>
                  )}
                  {commTotal > 0 && (
                    <tr><td className="px-5 py-3 text-slate-600">Commission payouts</td><td className="px-5 py-3 text-right tabular-nums text-slate-600">−{formatMoney(commTotal, 'CAD')}</td></tr>
                  )}
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="px-5 py-3 font-semibold">Net</td>
                    <td className={`px-5 py-3 text-right font-semibold tabular-nums ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatMoney(net, 'CAD')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <FadeIn delay={0.05} className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold">Expenses — {monthLabel}</h2>
                <div className="flex items-center gap-3">
                  <Link href="/finance/import" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-brand">
                    <Upload size={13} /> Import statement
                  </Link>
                  <span className="text-sm font-medium">{formatMoney(expenseTotal, 'CAD')}</span>
                </div>
              </div>
              {owedTotal > 0.5 && (
                <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">
                  <HandCoins size={16} className="shrink-0" />
                  <span>
                    <span className="font-semibold">{formatMoney(owedTotal, 'CAD')}</span> still owed to team members who
                    fronted expenses (all time).
                  </span>
                </div>
              )}
              {expenses.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-500">No expenses this month.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr><th className="px-5 py-3 font-medium">Expense</th><th className="px-5 py-3 font-medium">Category</th><th className="px-5 py-3 font-medium">Paid by</th><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 text-right font-medium">Amount</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {expenses.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3 font-medium text-slate-800">{e.title}</td>
                          <td className="px-5 py-3"><Pill className={EXPENSE_CATEGORY_BADGE[e.category] ?? 'bg-slate-100 text-slate-500'}>{EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}</Pill></td>
                          <td className="px-5 py-3">
                            {e.paidById ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-slate-700">{e.paidBy?.name ?? 'Team member'}</span>
                                <form action={toggleExpenseReimbursed.bind(null, e.id)}>
                                  <button
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
                                      e.reimbursed
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                    }`}
                                    title={e.reimbursed ? 'Mark as not reimbursed' : 'Mark as reimbursed'}
                                  >
                                    {e.reimbursed ? 'Reimbursed' : 'Mark reimbursed'}
                                  </button>
                                </form>
                              </div>
                            ) : (
                              <span className="text-slate-400">Company</span>
                            )}
                          </td>
                          <td className="px-5 py-3 tabular-nums text-slate-500">{e.date.toISOString().slice(0, 10)}</td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            <div className="font-medium">{formatMoney(e.amount, e.currency)}</div>
                            {e.currency !== 'CAD' && <div className="text-xs text-slate-400">{formatMoney(e.amountCad ?? cadOf(e.amount, e.currency), 'CAD')} CAD</div>}
                          </td>
                          <td className="px-5 py-3"><RowActions deleteAction={deleteExpense.bind(null, e.id)} label="expense" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <form action={addExpense} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Plus size={16} className="text-brand" /> Add expense</h2>
              <div className="space-y-3">
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Title *</span><input name="title" required className={inputCls} placeholder="Adobe CC" /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Category</span>
                  <select name="category" className={inputCls} defaultValue="OTHER">{expenseCats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="col-span-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">Amount *</span><input name="amount" type="number" min="0" step="any" required className={inputCls} placeholder="50" /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Currency</span><select name="currency" defaultValue="CAD" className={inputCls}>{currencies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Paid by</span>
                  <select name="paidById" defaultValue="" className={inputCls}>
                    <option value="">Company</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <span className="mt-1 block text-xs text-slate-400">If a team member fronted it, it shows as owed until reimbursed.</span>
                </label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Date</span><input name="date" type="date" defaultValue={today} className={inputCls} /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Note</span><input name="note" className={inputCls} /></label>
                <AnimatedButton className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">Add expense</AnimatedButton>
              </div>
            </form>
          </FadeIn>
        </div>
      )}

      {tab === 'salaries' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <FadeIn delay={0.05} className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold">Team salaries</h2>
                <span className="text-xs text-slate-400">Paid {monthLabel}: {formatMoney(salaryTotal, 'CAD')}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="px-5 py-3 font-medium">Member</th><th className="px-5 py-3 text-right font-medium">Current salary</th><th className="px-5 py-3 text-right font-medium">Paid this month</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const cur = u.salaries[0];
                      const paidThis = salaryPays.filter((p) => p.userId === u.id).reduce((s, p) => s + (p.amountCad ?? cadOf(p.amount, p.currency)), 0);
                      return (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3 font-medium text-slate-800">{u.name}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-600">{cur ? `${formatMoney(cur.amount, cur.currency)}/mo` : '—'}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-600">{paidThis ? formatMoney(paidThis, 'CAD') : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {salaryPays.length > 0 && (
              <FadeIn delay={0.12}>
                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold">Salary payments — {monthLabel}</h2></div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {salaryPays.map((p) => (
                          <tr key={p.id}>
                            <td className="px-5 py-3 font-medium text-slate-800">{p.user.name}</td>
                            <td className="px-5 py-3 tabular-nums text-slate-500">{p.paidAt.toISOString().slice(0, 10)}</td>
                            <td className="px-5 py-3 text-right tabular-nums">{formatMoney(p.amount, p.currency)}{p.currency !== 'CAD' && <span className="ml-2 text-xs text-slate-400">{formatMoney(p.amountCad ?? cadOf(p.amount, p.currency), 'CAD')} CAD</span>}</td>
                            <td className="px-5 py-3"><RowActions deleteAction={deleteSalaryPayment.bind(null, p.id)} label="salary payment" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </FadeIn>
            )}
          </FadeIn>

          <div className="space-y-6">
            <FadeIn delay={0.1}>
              <form action={setSalary} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold">Set / update salary</h2>
                <div className="space-y-3">
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Member *</span><select name="userId" required defaultValue="" className={inputCls}><option value="" disabled>Select…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="col-span-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">Monthly *</span><input name="amount" type="number" min="0" step="any" required className={inputCls} placeholder="1500" /></label>
                    <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Cur</span><select name="currency" defaultValue="CAD" className={inputCls}>{currencies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
                  </div>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Effective from</span><input name="effectiveFrom" type="date" defaultValue={today} className={inputCls} /></label>
                  <AnimatedButton className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">Save salary</AnimatedButton>
                </div>
              </form>
            </FadeIn>

            <FadeIn delay={0.14}>
              <form action={recordSalaryPayment} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold">Record salary payment</h2>
                <div className="space-y-3">
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Member *</span><select name="userId" required defaultValue="" className={inputCls}><option value="" disabled>Select…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="col-span-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">Amount *</span><input name="amount" type="number" min="0" step="any" required className={inputCls} placeholder="1500" /></label>
                    <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Cur</span><select name="currency" defaultValue="CAD" className={inputCls}>{currencies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
                  </div>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Date</span><input name="paidAt" type="date" defaultValue={today} className={inputCls} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Method</span><input name="method" className={inputCls} placeholder="Wise, Remitly…" /></label>
                  <AnimatedButton className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">Record payment</AnimatedButton>
                </div>
              </form>
            </FadeIn>
          </div>
        </div>
      )}

      {tab === 'loans' && (
        <div>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: 'Total received', value: formatMoney(loanGiven, 'CAD'), icon: Landmark, tint: 'bg-slate-100 text-slate-600' },
              { label: 'Paid back', value: formatMoney(loanRecovered, 'CAD'), icon: RotateCcw, tint: 'bg-emerald-50 text-emerald-600' },
              { label: 'Still to pay back', value: formatMoney(loanOutstanding, 'CAD'), icon: HandCoins, tint: loanOutstanding > 0.5 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500' },
            ].map((s, i) => (
              <FadeIn key={s.label} delay={0.04 * i}>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${s.tint}`}><s.icon size={20} /></span>
                  <div className="mt-4 text-2xl font-semibold tracking-tight">{s.value}</div>
                  <div className="mt-0.5 text-sm text-slate-500">{s.label}</div>
                </div>
              </FadeIn>
            ))}
          </section>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <FadeIn delay={0.08} className="lg:col-span-2">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-sm font-semibold">Loans into the business</h2>
                  <p className="mt-0.5 text-xs text-slate-400">Who put money in, how much, what for — and whether they’ve been paid back.</p>
                </div>
                {loans.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-slate-500">No loans recorded. Add one on the right.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-3 font-medium">Given by</th>
                          <th className="px-5 py-3 font-medium">For what</th>
                          <th className="px-5 py-3 font-medium">Date</th>
                          <th className="px-5 py-3 text-right font-medium">Amount</th>
                          <th className="px-5 py-3 font-medium">Paid back?</th>
                          <th className="px-5 py-3 font-medium">Record repayment</th>
                          <th className="px-5 py-3 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loans.map((l) => {
                          const givenCad = l.amountCad ?? cadOf(l.amount, l.currency);
                          const outstanding = givenCad - l.recoveredAmount;
                          const settled = outstanding <= 0.5;
                          return (
                            <tr key={l.id} className="hover:bg-slate-50">
                              <td className="px-5 py-3 font-medium text-slate-800">{l.counterparty}</td>
                              <td className="px-5 py-3 text-slate-500">{l.note || '—'}</td>
                              <td className="px-5 py-3 tabular-nums text-slate-500">{l.givenAt.toISOString().slice(0, 10)}</td>
                              <td className="px-5 py-3 text-right tabular-nums">
                                <div className="font-medium">{formatMoney(l.amount, l.currency)}</div>
                                {l.currency !== 'CAD' && <div className="text-xs text-slate-400">{formatMoney(givenCad, 'CAD')} CAD</div>}
                              </td>
                              <td className="px-5 py-3">
                                {settled ? (
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Paid back</span>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 w-fit">
                                      {formatMoney(outstanding, 'CAD')} owed
                                    </span>
                                    {l.recoveredAmount > 0.5 && (
                                      <span className="text-xs text-slate-400">{formatMoney(l.recoveredAmount, 'CAD')} paid so far</span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-5 py-3">
                                {settled ? (
                                  <span className="text-xs text-slate-400">—</span>
                                ) : (
                                  <form action={recordLoanRecovery} className="flex items-center gap-1.5">
                                    <input type="hidden" name="loanId" value={l.id} />
                                    <input
                                      name="amount"
                                      type="number"
                                      min="0"
                                      step="any"
                                      required
                                      placeholder="CAD"
                                      className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
                                    />
                                    <button className="rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark">Pay</button>
                                  </form>
                                )}
                              </td>
                              <td className="px-5 py-3"><RowActions deleteAction={deleteLoan.bind(null, l.id)} label="loan" /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </FadeIn>

            <FadeIn delay={0.12}>
              <form action={addLoan} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Plus size={16} className="text-brand" /> Add a loan</h2>
                <div className="space-y-3">
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Given by *</span><input name="counterparty" required className={inputCls} placeholder="Who put the money in" /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">For what</span><input name="note" className={inputCls} placeholder="e.g. startup costs, equipment" /></label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="col-span-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">Amount *</span><input name="amount" type="number" min="0" step="any" required className={inputCls} placeholder="1000" /></label>
                    <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Cur</span><select name="currency" defaultValue="CAD" className={inputCls}>{currencies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
                  </div>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Date received</span><input name="givenAt" type="date" defaultValue={today} className={inputCls} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Already paid back (CAD)</span><input name="recoveredAmount" type="number" min="0" step="any" className={inputCls} placeholder="0" /><span className="mt-1 block text-xs text-slate-400">For older loans that are already partly repaid.</span></label>
                  <AnimatedButton className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">Add loan</AnimatedButton>
                </div>
              </form>
            </FadeIn>
          </div>
        </div>
      )}
    </div>
  );
}
