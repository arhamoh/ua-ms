import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart3, Clock, Coins, Wallet, Users } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getRatesToCad, toCad } from '@/lib/fx';
import { formatMoney } from '@/lib/enums';
import FadeIn from '@/components/FadeIn';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER'];
const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

function pct(active: number, totalSeconds: number) {
  return totalSeconds <= 0 ? null : Math.min(100, Math.round((active / totalSeconds) * 100));
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; user?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.roles.some((r) => ADMIN_ROLES.includes(r))) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-800">
        Only admins and managers can view team reports.{' '}
        <Link href="/" className="font-medium underline">Back to dashboard</Link>.
      </div>
    );
  }

  const sp = await searchParams;
  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();

  // Default range: 1st of this month → today.
  const from = isDate(sp.from) ? sp.from! : `${y}-${pad(mo + 1)}-01`;
  const to = isDate(sp.to) ? sp.to! : fmt(now);
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000); // inclusive of `to`

  // Quick-range presets.
  const dow = (now.getUTCDay() + 6) % 7; // 0 = Monday
  const weekStart = fmt(new Date(Date.UTC(y, mo, now.getUTCDate() - dow)));
  const monthStart = `${y}-${pad(mo + 1)}-01`;
  const lastMonthStart = fmt(new Date(Date.UTC(y, mo - 1, 1)));
  const lastMonthEnd = fmt(new Date(Date.UTC(y, mo, 0)));
  const presets = [
    { label: 'This week', from: weekStart, to: fmt(now) },
    { label: 'This month', from: monthStart, to: fmt(now) },
    { label: 'Last month', from: lastMonthStart, to: lastMonthEnd },
  ];
  const presetHref = (p: { from: string; to: string }) =>
    `/reports?from=${p.from}&to=${p.to}${sp.user ? `&user=${sp.user}` : ''}`;
  const isActive = (p: { from: string; to: string }) => p.from === from && p.to === to;

  const rates = await getRatesToCad();
  const cad = (amt: number, cur: string) => toCad(amt, cur, rates);

  const [users, entries, salaryPays, commPays, salaries] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, roles: true } }),
    prisma.timeEntry.findMany({
      where: { checkInAt: { gte: start, lt: end }, checkOutAt: { not: null } },
      select: { userId: true, hours: true, activeSeconds: true },
    }),
    prisma.salaryPayment.findMany({
      where: { paidAt: { gte: start, lt: end } },
      select: { userId: true, amount: true, currency: true, amountCad: true },
    }),
    prisma.commissionPayout.findMany({
      where: { paidAt: { gte: start, lt: end } },
      select: { userId: true, amount: true },
    }),
    prisma.salary.findMany({
      where: { effectiveFrom: { lte: end } },
      orderBy: { effectiveFrom: 'desc' },
      select: { userId: true, amount: true, currency: true },
    }),
  ]);

  // Current monthly salary rate = latest effective salary per user.
  const rate = new Map<string, number>();
  for (const s of salaries) if (!rate.has(s.userId)) rate.set(s.userId, cad(s.amount, s.currency));

  type Row = { id: string; name: string; roles: string[]; hours: number; active: number; rate: number; salaryPaid: number; commission: number };
  const byUser = new Map<string, Row>();
  for (const u of users) {
    byUser.set(u.id, { id: u.id, name: u.name, roles: u.roles, hours: 0, active: 0, rate: rate.get(u.id) ?? 0, salaryPaid: 0, commission: 0 });
  }
  for (const e of entries) {
    const r = byUser.get(e.userId);
    if (r) { r.hours += e.hours ?? 0; r.active += e.activeSeconds; }
  }
  for (const p of salaryPays) {
    const r = byUser.get(p.userId);
    if (r) r.salaryPaid += p.amountCad ?? cad(p.amount, p.currency);
  }
  for (const c of commPays) {
    const r = byUser.get(c.userId);
    if (r) r.commission += c.amount;
  }

  let rows = [...byUser.values()];
  if (sp.user) rows = rows.filter((r) => r.id === sp.user);
  // Drop members with no rate and no activity/pay in range (keeps the report tidy).
  rows = rows.filter((r) => r.hours > 0 || r.salaryPaid > 0 || r.commission > 0 || r.rate > 0);

  const tot = rows.reduce(
    (a, r) => ({ hours: a.hours + r.hours, salary: a.salary + r.salaryPaid, comm: a.comm + r.commission }),
    { hours: 0, salary: 0, comm: 0 },
  );
  const totalPaid = tot.salary + tot.comm;

  const rangeLabel = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${new Date(end.getTime() - 86_400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;

  return (
    <div>
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
              <BarChart3 size={22} className="text-brand" /> Team reports
            </h1>
            <p className="mt-1 text-sm text-slate-500">Hours, salary, and commission per member — {rangeLabel}.</p>
          </div>
          <PrintButton label="Print / Export" />
        </div>
      </FadeIn>

      {/* Range controls */}
      <FadeIn delay={0.04}>
        <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Link
                key={p.label}
                href={presetHref(p)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  isActive(p) ? 'border-brand bg-brand-light text-brand' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
          <form className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">From</span>
              <input type="date" name="from" defaultValue={from} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">To</span>
              <input type="date" name="to" defaultValue={to} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Member</span>
              <select name="user" defaultValue={sp.user ?? ''} className={inputCls}>
                <option value="">All members</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">Apply</button>
          </form>
        </div>
      </FadeIn>

      {/* Summary tiles */}
      <FadeIn delay={0.08}>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile icon={<Clock size={14} />} label="Hours" value={`${tot.hours.toFixed(1)}h`} />
          <Tile icon={<Wallet size={14} />} label="Salary paid" value={formatMoney(tot.salary, 'CAD')} />
          <Tile icon={<Coins size={14} />} label="Commission" value={formatMoney(tot.comm, 'CAD')} />
          <Tile icon={<Users size={14} />} label="Total paid" value={formatMoney(totalPaid, 'CAD')} accent />
        </div>
      </FadeIn>

      {/* Per-member table */}
      <FadeIn delay={0.12}>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">No data for this range.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Member</th>
                    <th className="px-5 py-3 text-right font-medium">Hours</th>
                    <th className="px-5 py-3 text-right font-medium">Active</th>
                    <th className="px-5 py-3 text-right font-medium">Salary rate</th>
                    <th className="px-5 py-3 text-right font-medium">Salary paid</th>
                    <th className="px-5 py-3 text-right font-medium">Commission</th>
                    <th className="px-5 py-3 text-right font-medium">Total paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const p = pct(r.active, r.hours * 3600);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-800">{r.name}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{r.hours.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-500">{p != null ? `${(r.active / 3600).toFixed(1)}h · ${p}%` : '—'}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-500">{r.rate > 0 ? `${formatMoney(r.rate, 'CAD')}/mo` : '—'}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{r.salaryPaid > 0 ? formatMoney(r.salaryPaid, 'CAD') : '—'}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{r.commission > 0 ? formatMoney(r.commission, 'CAD') : '—'}</td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatMoney(r.salaryPaid + r.commission, 'CAD')}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <td className="px-5 py-3">Total</td>
                    <td className="px-5 py-3 text-right tabular-nums">{tot.hours.toFixed(1)}</td>
                    <td className="px-5 py-3" />
                    <td className="px-5 py-3" />
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(tot.salary, 'CAD')}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(tot.comm, 'CAD')}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(totalPaid, 'CAD')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}

function Tile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${accent ? 'border-brand/30 bg-brand-light/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">{icon} {label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-slate-900">{value}</div>
    </div>
  );
}
