import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PROJECT_STATUS_LABELS, STATUS_BADGE, PROJECT_TYPE_LABELS } from '@/lib/enums';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [clients, projects, team, recentProjects] = await Promise.all([
    prisma.client.count(),
    prisma.project.count(),
    prisma.user.count(),
    prisma.project.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { client: true },
    }),
  ]);

  const stats = [
    { label: 'Clients', value: clients, href: '/clients' },
    { label: 'Projects', value: projects, href: '/clients' },
    { label: 'Team members', value: team, href: '/team' },
  ];

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of clients, projects, and your team.
          </p>
        </div>
        <Link
          href="/onboard"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + Onboard Client
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand/40 hover:shadow"
          >
            <div className="text-3xl font-semibold text-brand">{s.value}</div>
            <div className="mt-1 text-sm text-slate-500">{s.label}</div>
          </Link>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent projects
        </h2>
        {recentProjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-slate-500">No projects yet.</p>
            <Link
              href="/onboard"
              className="mt-3 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Onboard your first client
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentProjects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/projects/${p.id}`} className="font-medium text-brand hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.client.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {PROJECT_TYPE_LABELS[p.type] ?? p.type}
                    </td>
                    <td className="px-4 py-3">
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
      </section>
    </div>
  );
}
