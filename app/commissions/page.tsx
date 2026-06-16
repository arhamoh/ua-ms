import { TrendingUp, Wallet, Scale, Plus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { recordCommissionPayout } from '@/app/actions';
import { ROLE_LABELS, SALES_COMMISSION_RATE, formatMoney } from '@/lib/enums';
import { getRatesToCad, toCad } from '@/lib/fx';
import { getLeadTypeRates } from '@/lib/options';
import FadeIn from '@/components/FadeIn';

export const dynamic = 'force-dynamic';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

const isPipeline = (status: string) => status !== 'COMPLETED' && status !== 'ARCHIVED';

export default async function CommissionsPage() {
  const [users, rates] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: 'asc' },
      include: {
        salesLeads: { include: { projects: true, payments: true } },
        projectMembers: {
          where: { role: 'PROJECT_MANAGER' },
          include: {
            project: {
              include: { payments: true, members: { where: { role: 'PROJECT_MANAGER' } } },
            },
          },
        },
        commissionPayouts: { orderBy: { paidAt: 'desc' } },
      },
    }),
    getRatesToCad(),
  ]);
  const leadRates = await getLeadTypeRates();

  const cad = (amt: number | null, cur: string | null) => toCad(amt ?? 0, cur, rates);

  const rows = users.map((u) => {
    let salesProjected = 0;
    let salesEarned = 0;
    for (const client of u.salesLeads) {
      const lt = client.leadType ?? '';
      const rate = (leadRates[lt] ?? SALES_COMMISSION_RATE[lt] ?? 0) / 100;
      for (const p of client.projects) {
        if (isPipeline(p.status)) salesProjected += cad(p.budgetAmount, p.budgetCurrency) * rate;
      }
      for (const pay of client.payments) {
        salesEarned += (pay.amountCad ?? cad(pay.amount, pay.currency)) * rate;
      }
    }

    let pmProjected = 0;
    let pmEarned = 0;
    for (const pm of u.projectMembers) {
      const proj = pm.project;
      const numPMs = Math.max(1, proj.members.length);
      const rate = (proj.pmCommissionRate ?? 0) / 100;
      if (isPipeline(proj.status)) {
        pmProjected += (cad(proj.budgetAmount, proj.budgetCurrency) * rate) / numPMs;
      }
      for (const pay of proj.payments) {
        pmEarned += ((pay.amountCad ?? cad(pay.amount, pay.currency)) * rate) / numPMs;
      }
    }

    const paid = u.commissionPayouts.reduce((s, p) => s + p.amount, 0);
    const projected = salesProjected + pmProjected;
    const earned = salesEarned + pmEarned;

    return {
      id: u.id,
      name: u.name,
      roles: u.roles,
      leads: u.salesLeads.length,
      pmProjects: u.projectMembers.length,
      projected,
      earned,
      paid,
      outstanding: earned - paid,
      active: u.salesLeads.length > 0 || u.projectMembers.length > 0 || paid > 0,
    };
  });

  const people = rows.filter((r) => r.active);

  const totals = people.reduce(
    (acc, r) => ({
      projected: acc.projected + r.projected,
      earned: acc.earned + r.earned,
      paid: acc.paid + r.paid,
      outstanding: acc.outstanding + r.outstanding,
    }),
    { projected: 0, earned: 0, paid: 0, outstanding: 0 },
  );

  const summary = [
    { label: 'Projected (pipeline)', value: formatMoney(totals.projected, 'CAD'), icon: TrendingUp, tint: 'bg-rose-50 text-rose-600' },
    { label: 'Earned (to date)', value: formatMoney(totals.earned, 'CAD'), icon: Wallet, tint: 'bg-emerald-50 text-emerald-600' },
    { label: 'Outstanding to pay', value: formatMoney(totals.outstanding, 'CAD'), icon: Scale, tint: totals.outstanding > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500' },
  ];

  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      <FadeIn>
        <h1 className="text-2xl font-bold tracking-tight">Commissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sales &amp; PM commissions in CAD. Projected = % of pipeline project value; earned = % of
          payments received. Record payouts to track what’s been paid.
        </p>
      </FadeIn>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary.map((s, i) => (
          <FadeIn key={s.label} delay={0.04 * i}>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${s.tint}`}>
                <s.icon size={20} />
              </span>
              <div className="mt-4 text-2xl font-semibold tracking-tight">{s.value}</div>
              <div className="mt-0.5 text-sm text-slate-500">{s.label}</div>
            </div>
          </FadeIn>
        ))}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* People table */}
        <FadeIn delay={0.08} className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold">By team member</h2>
            </div>
            {people.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                No commission activity yet. Assign a salesperson + lead type when onboarding a client,
                and a PM to projects.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Member</th>
                      <th className="px-5 py-3 text-right font-medium">Projected</th>
                      <th className="px-5 py-3 text-right font-medium">Earned</th>
                      <th className="px-5 py-3 text-right font-medium">Paid</th>
                      <th className="px-5 py-3 text-right font-medium">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {people.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-800">{r.name}</div>
                          <div className="text-xs text-slate-400">
                            {r.roles.map((x) => ROLE_LABELS[x] ?? x).join(', ') || '—'}
                            {r.leads > 0 && ` · ${r.leads} lead${r.leads === 1 ? '' : 's'}`}
                            {r.pmProjects > 0 && ` · PM on ${r.pmProjects}`}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-500">{formatMoney(r.projected, 'CAD')}</td>
                        <td className="px-5 py-3 text-right font-medium tabular-nums">{formatMoney(r.earned, 'CAD')}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-500">{formatMoney(r.paid, 'CAD')}</td>
                        <td className={`px-5 py-3 text-right font-medium tabular-nums ${r.outstanding > 0.01 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {formatMoney(r.outstanding, 'CAD')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </FadeIn>

        {/* Record payout */}
        <FadeIn delay={0.12}>
          <form action={recordCommissionPayout} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Plus size={16} className="text-brand" /> Record a payout
            </h2>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Team member *</span>
                <select name="userId" required className={inputCls} defaultValue="">
                  <option value="" disabled>Select…</option>
                  {(people.length ? people : rows).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Amount (CAD) *</span>
                <input name="amount" type="number" min="0" step="any" required className={inputCls} placeholder="500" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Date</span>
                <input name="paidAt" type="date" defaultValue={today} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Method</span>
                <input name="method" className={inputCls} placeholder="Wise, Payoneer, bank…" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Note</span>
                <input name="note" className={inputCls} placeholder="e.g. June commission" />
              </label>
              <button
                type="submit"
                className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
              >
                Record payout
              </button>
            </div>
          </form>
        </FadeIn>
      </div>
    </div>
  );
}
