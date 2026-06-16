import Link from 'next/link';
import { TrendingUp, Wallet, Scale, Plus, Coins } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { recordCommissionPayout } from '@/app/actions';
import { SALES_COMMISSION_RATE, formatMoney } from '@/lib/enums';
import { getRatesToCad, toCad } from '@/lib/fx';
import { getLeadTypeRates, getOptions, ensureOptionDefaults } from '@/lib/options';
import FadeIn from '@/components/FadeIn';
import RowActions from '@/components/RowActions';
import AnimatedButton from '@/components/AnimatedButton';

export const dynamic = 'force-dynamic';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

const isPipeline = (status: string) => status !== 'COMPLETED' && status !== 'ARCHIVED';

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function roleHint(r: { leads: number; pmProjects: number }) {
  const bits: string[] = [];
  if (r.leads > 0) bits.push(`${r.leads} lead${r.leads === 1 ? '' : 's'}`);
  if (r.pmProjects > 0) bits.push(`PM on ${r.pmProjects}`);
  return bits.join(' · ') || 'Past payouts';
}

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
  await ensureOptionDefaults('paymentMethod');
  const methods = await getOptions('paymentMethod');

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
    { label: 'Paid out', value: formatMoney(totals.paid, 'CAD'), icon: Coins, tint: 'bg-slate-100 text-slate-500' },
    { label: 'Outstanding to pay', value: formatMoney(totals.outstanding, 'CAD'), icon: Scale, tint: totals.outstanding > 0.01 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600' },
  ];

  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      <FadeIn>
        <h1 className="text-2xl font-bold tracking-tight">Commissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sales &amp; PM commissions in CAD. Projected = % of pipeline project value; earned = % of
          payments received. Open a member to see the per-project breakdown.
        </p>
      </FadeIn>

      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary.map((s, i) => (
          <FadeIn key={s.label} delay={0.04 * i}>
            <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${s.tint}`}>
                <s.icon size={20} />
              </span>
              <div className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">{s.value}</div>
              <div className="mt-0.5 text-sm text-slate-500">{s.label}</div>
            </div>
          </FadeIn>
        ))}
      </section>

      {/* People table — full width */}
      <FadeIn delay={0.1}>
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold">By team member</h2>
            <span className="text-xs text-slate-400">{people.length} eligible</span>
          </div>
          {people.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No commission activity yet. Assign a salesperson + lead type when onboarding a client,
              and a PM to projects.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Member</th>
                    <th className="px-5 py-3 text-right font-medium">Projected</th>
                    <th className="px-5 py-3 text-right font-medium">Earned</th>
                    <th className="px-5 py-3 text-right font-medium">Paid</th>
                    <th className="px-5 py-3 text-right font-medium">Outstanding</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {people.map((r) => {
                    const pct = r.earned > 0.01 ? Math.min(100, Math.round((r.paid / r.earned) * 100)) : 0;
                    return (
                      <tr key={r.id} className="transition hover:bg-slate-50">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-light text-xs font-semibold text-brand">
                              {initials(r.name)}
                            </span>
                            <div className="min-w-0">
                              <Link href={`/commissions/${r.id}`} className="font-medium text-slate-800 hover:text-brand">
                                {r.name}
                              </Link>
                              <div className="text-xs text-slate-400">{roleHint(r)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-slate-500">{formatMoney(r.projected, 'CAD')}</td>
                        <td className="px-5 py-3.5 text-right font-medium tabular-nums text-slate-800">{formatMoney(r.earned, 'CAD')}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="tabular-nums text-slate-500">{formatMoney(r.paid, 'CAD')}</div>
                          <div className="ml-auto mt-1 h-1 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className={`px-5 py-3.5 text-right font-semibold tabular-nums ${r.outstanding > 0.01 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {formatMoney(r.outstanding, 'CAD')}
                        </td>
                        <td className="px-5 py-3.5">
                          <RowActions viewHref={`/commissions/${r.id}`} label="member" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <td className="px-5 py-3">Total</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(totals.projected, 'CAD')}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(totals.earned, 'CAD')}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(totals.paid, 'CAD')}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(totals.outstanding, 'CAD')}</td>
                    <td className="px-5 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </FadeIn>

      {/* Record payout — full-width horizontal form */}
      <FadeIn delay={0.14}>
        <form action={recordCommissionPayout} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Plus size={16} className="text-brand" /> Record a payout
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
              <select name="method" defaultValue="BANK_TRANSFER" className={inputCls}>
                {methods.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Note</span>
              <input name="note" className={inputCls} placeholder="e.g. June commission" />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <AnimatedButton
              type="submit"
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-dark"
            >
              Record payout
            </AnimatedButton>
          </div>
        </form>
      </FadeIn>
    </div>
  );
}
