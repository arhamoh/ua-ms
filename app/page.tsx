import Link from 'next/link';
import { Briefcase, Users, FolderKanban, Activity, ArrowRight, ArrowUpRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { PROJECT_STATUS_LABELS, STATUS_BADGE, PROJECT_TYPE_LABELS } from '@/lib/enums';
import FadeIn from '@/components/FadeIn';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [clients, projects, team, activeCount, statusGroups, recentProjects] =
    await Promise.all([
      prisma.client.count(),
      prisma.project.count(),
      prisma.user.count(),
      prisma.project.count({ where: { status: 'ACTIVE' } }),
      prisma.project.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.project.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: { client: true },
      }),
    ]);

  const stats = [
    { label: 'Clients', value: clients, icon: Briefcase, tint: 'bg-indigo-50 text-indigo-600', href: '/clients' },
    { label: 'Total projects', value: projects, icon: FolderKanban, tint: 'bg-violet-50 text-violet-600', href: '/clients' },
    { label: 'Active projects', value: activeCount, icon: Activity, tint: 'bg-emerald-50 text-emerald-600', href: '/clients' },
    { label: 'Team members', value: team, icon: Users, tint: 'bg-amber-50 text-amber-600', href: '/team' },
  ];

  const statusCounts: Record<string, number> = {};
  statusGroups.forEach((g) => (statusCounts[g.status] = g._count._all));

  return (
    <div>
      <FadeIn>
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-500">
              Here’s what’s happening across your agency.
            </p>
          </div>
          <Link
            href="/onboard"
            className="hidden rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark sm:block"
          >
            Onboard Client
          </Link>
        </div>
      </FadeIn>

      {/* Stat cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <FadeIn key={s.label} delay={0.04 * i}>
            <Link
              href={s.href}
              className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${s.tint}`}>
                  <s.icon size={20} />
                </span>
                <ArrowUpRight
                  size={16}
                  className="text-slate-300 transition group-hover:text-brand"
                />
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight">{s.value}</div>
              <div className="mt-0.5 text-sm text-slate-500">{s.label}</div>
            </Link>
          </FadeIn>
        ))}
      </section>

      {/* Two columns */}
      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <FadeIn delay={0.1} className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold">Recent projects</h2>
              <Link href="/clients" className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                View all <ArrowRight size={13} />
              </Link>
            </div>
            {recentProjects.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                No projects yet.{' '}
                <Link href="/onboard" className="font-medium text-brand hover:underline">
                  Onboard your first client
                </Link>
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
                          <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-brand">
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-slate-500">{p.client.name}</td>
                        <td className="px-5 py-3 text-slate-500">
                          {PROJECT_TYPE_LABELS[p.type] ?? p.type}
                        </td>
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

        <FadeIn delay={0.16}>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Projects by status</h2>
            <div className="mt-4 space-y-3">
              {Object.keys(PROJECT_STATUS_LABELS).map((status) => {
                const count = statusCounts[status] ?? 0;
                const pct = projects ? Math.round((count / projects) * 100) : 0;
                return (
                  <div key={status}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-600">{PROJECT_STATUS_LABELS[status]}</span>
                      <span className="font-medium text-slate-900">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}
