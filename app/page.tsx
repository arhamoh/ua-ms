import Link from 'next/link';
import { Briefcase, Activity, Scale, TrendingUp, ArrowRight, ArrowUpRight, CalendarClock, ListTodo } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { PROJECT_STATUS_LABELS, STATUS_BADGE, PROJECT_TYPE_LABELS, formatMoney } from '@/lib/enums';
import { getRatesToCad, toCad } from '@/lib/fx';
import { getSession } from '@/lib/auth';
import FadeIn from '@/components/FadeIn';
import DashboardGreeting from '@/components/DashboardGreeting';
import InlineSearch from '@/components/InlineSearch';
import IncomeExpenseChart from '@/components/charts/IncomeExpenseChart';
import DonutChart from '@/components/charts/DonutChart';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  ONBOARDING: '#f59e0b',
  ACTIVE: '#10b981',
  ON_HOLD: '#94a3b8',
  COMPLETED: '#3b82f6',
  CANCELLED: '#e11d48',
  ARCHIVED: '#cbd5e1',
};
const TYPE_PALETTE = ['#e11d48', '#8b5cf6', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#64748b'];
const pad = (n: number) => String(n).padStart(2, '0');

export default async function DashboardPage() {
  const session = await getSession();
  const userName = session?.name || 'there';

  const now = new Date();
  const sixAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const in45 = new Date(now.getTime() + 45 * 86400000);
  const in14 = new Date(now.getTime() + 14 * 86400000);

  const [rates, clientCount, teamCount, projects, payments, expenses, salaryPays, commPays, upcomingTasks] =
    await Promise.all([
      getRatesToCad(),
      prisma.client.count(),
      prisma.user.count(),
      prisma.project.findMany({ include: { client: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.payment.findMany(),
      prisma.expense.findMany({ where: { date: { gte: sixAgo } } }),
      prisma.salaryPayment.findMany({ where: { paidAt: { gte: sixAgo } } }),
      prisma.commissionPayout.findMany({ where: { paidAt: { gte: sixAgo } } }),
      prisma.task.findMany({
        where: { status: { not: 'DONE' }, dueDate: { not: null, lte: in14 } },
        include: { project: { select: { id: true, name: true } }, assignee: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 8,
      }),
    ]);

  const payCad = (p: { amount: number; currency: string; amountCad: number | null }) =>
    p.amountCad ?? toCad(p.amount, p.currency, rates);

  // Totals
  const billed = projects.reduce((s, p) => s + (p.budgetAmount != null ? toCad(p.budgetAmount, p.budgetCurrency, rates) : 0), 0);
  const paid = payments.reduce((s, p) => s + payCad(p), 0);
  const outstanding = billed - paid;
  const activeCount = projects.filter((p) => p.status === 'ACTIVE').length;

  // 6-month income vs expense trend
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
    return {
      key: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`,
      month: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      income: 0,
      expense: 0,
    };
  });
  const idx: Record<string, (typeof months)[number]> = {};
  months.forEach((m) => (idx[m.key] = m));
  const bucket = (date: Date) => idx[`${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`];
  payments.forEach((p) => { const m = bucket(p.paidAt); if (m) m.income += payCad(p); });
  expenses.forEach((e) => { const m = bucket(e.date); if (m) m.expense += e.amountCad ?? toCad(e.amount, e.currency, rates); });
  salaryPays.forEach((p) => { const m = bucket(p.paidAt); if (m) m.expense += payCad(p); });
  commPays.forEach((p) => { const m = bucket(p.paidAt); if (m) m.expense += p.amount; });
  const trend = months.map((m) => ({ month: m.month, income: Math.round(m.income), expense: Math.round(m.expense) }));
  const thisMonth = months[5];
  const netThisMonth = Math.round(thisMonth.income - thisMonth.expense);

  // Status + type distributions
  const statusCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  projects.forEach((p) => {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
    typeCounts[p.type] = (typeCounts[p.type] ?? 0) + 1;
  });
  const statusData = Object.keys(PROJECT_STATUS_LABELS)
    .filter((s) => statusCounts[s])
    .map((s) => ({ name: PROJECT_STATUS_LABELS[s], value: statusCounts[s], color: STATUS_COLORS[s] }));
  const typeData = Object.keys(typeCounts).map((t, i) => ({
    name: PROJECT_TYPE_LABELS[t] ?? t,
    value: typeCounts[t],
    color: TYPE_PALETTE[i % TYPE_PALETTE.length],
  }));

  // Upcoming deadlines
  const deadlines = projects
    .filter((p) => p.deadline && new Date(p.deadline) <= in45 && !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(p.status))
    .sort((a, b) => +new Date(a.deadline!) - +new Date(b.deadline!))
    .slice(0, 6);
  const daysUntil = (d: Date) => Math.round((+new Date(new Date(d).toDateString()) - +new Date(now.toDateString())) / 86400000);

  const recentProjects = projects.slice(0, 6);

  const stats = [
    { label: 'Clients', value: String(clientCount), icon: Briefcase, tint: 'bg-rose-50 text-rose-600', href: '/clients' },
    { label: 'Active projects', value: String(activeCount), icon: Activity, tint: 'bg-emerald-50 text-emerald-600', href: '/clients' },
    { label: 'Outstanding', value: formatMoney(outstanding, 'CAD'), icon: Scale, tint: outstanding > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500', href: '/finance' },
    { label: 'Net this month', value: formatMoney(netThisMonth, 'CAD'), icon: TrendingUp, tint: netThisMonth >= 0 ? 'bg-sky-50 text-sky-600' : 'bg-rose-50 text-rose-600', href: '/finance' },
  ];

  return (
    <div>
      <FadeIn className="mb-5 block">
        <DashboardGreeting name={userName} />
      </FadeIn>

      <FadeIn className="relative z-20 mb-6 block">
        <InlineSearch />
      </FadeIn>

      {/* Stat tiles */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <FadeIn key={s.label} delay={0.04 * i} className="h-full">
            <Link href={s.href} className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${s.tint}`}>
                  <s.icon size={20} />
                </span>
                <ArrowUpRight size={16} className="text-slate-300 transition group-hover:text-brand" />
              </div>
              <div className="mt-auto pt-5">
                <div className="truncate text-2xl font-semibold tracking-tight">{s.value}</div>
                <div className="mt-0.5 text-sm text-slate-500">{s.label}</div>
              </div>
            </Link>
          </FadeIn>
        ))}
      </section>

      {/* Charts: income/expense + status donut */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <FadeIn delay={0.08} className="h-full lg:col-span-2">
          <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Income vs Expenses</h2>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Income</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand" /> Expenses</span>
                <span className="text-slate-400">last 6 months · CAD</span>
              </div>
            </div>
            <IncomeExpenseChart data={trend} />
          </div>
        </FadeIn>

        <FadeIn delay={0.12} className="h-full">
          <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold">Projects by status</h2>
            <div className="flex flex-1 items-center">
              <DonutChart data={statusData} />
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Upcoming deadlines + tasks */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FadeIn delay={0.08} className="h-full">
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <CalendarClock size={16} className="text-brand" />
              <h2 className="text-sm font-semibold">Upcoming deadlines</h2>
            </div>
            {deadlines.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-5 py-10 text-center text-sm text-slate-500">No deadlines in the next 45 days.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {deadlines.map((p) => {
                  const d = daysUntil(p.deadline!);
                  return (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                          <span className="block truncate text-xs text-slate-400">{p.client.name}</span>
                        </span>
                        <span className="text-right">
                          <span className="block text-xs tabular-nums text-slate-500">{new Date(p.deadline!).toISOString().slice(0, 10)}</span>
                          <span className={`text-[11px] font-medium ${d < 0 ? 'text-rose-600' : d <= 7 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {d < 0 ? `${-d}d overdue` : d === 0 ? 'today' : `in ${d}d`}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={0.12} className="h-full">
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <ListTodo size={16} className="text-brand" />
              <h2 className="text-sm font-semibold">Upcoming tasks</h2>
            </div>
            {upcomingTasks.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-5 py-10 text-center text-sm text-slate-500">No tasks due in the next 14 days.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcomingTasks.map((t) => {
                  const d = daysUntil(t.dueDate!);
                  return (
                    <li key={t.id}>
                      <Link href={`/projects/${t.project.id}?tab=tasks`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">{t.title}</span>
                          <span className="block truncate text-xs text-slate-400">
                            {t.project.name}{t.assignee ? ` · ${t.assignee.name}` : ''}
                          </span>
                        </span>
                        <span className={`shrink-0 text-[11px] font-medium ${d < 0 ? 'text-rose-600' : d <= 3 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {d < 0 ? `${-d}d overdue` : d === 0 ? 'today' : `in ${d}d`}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </FadeIn>
      </section>

      {/* Recent projects + project types */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <FadeIn delay={0.08} className="h-full lg:col-span-2">
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold">Recent projects</h2>
              <Link href="/clients" className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                View all <ArrowRight size={13} />
              </Link>
            </div>
            {recentProjects.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                No projects yet.{' '}
                <Link href="/onboard" className="font-medium text-brand hover:underline">Onboard your first client</Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Project</th>
                      <th className="px-5 py-3 font-medium">Client</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentProjects.map((p) => (
                      <tr key={p.id} className="transition hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-brand">{p.name}</Link>
                        </td>
                        <td className="px-5 py-3 text-slate-500">{p.client.name}</td>
                        <td className="px-5 py-3 text-slate-500">{PROJECT_TYPE_LABELS[p.type] ?? p.type}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status] ?? ''}`}>
                            {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={0.12} className="h-full">
          <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold">Project types</h2>
            <div className="flex flex-1 items-center">
              <DonutChart data={typeData} />
            </div>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}
