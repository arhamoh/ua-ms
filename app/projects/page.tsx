import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PROJECT_STATUS_LABELS, STATUS_BADGE, PROJECT_TYPE_LABELS, formatMoney } from '@/lib/enums';
import FadeIn from '@/components/FadeIn';
import RowActions from '@/components/RowActions';
import { deleteProject } from '@/app/actions';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date | null) {
  return d ? new Date(d).toISOString().slice(0, 10) : '—';
}

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { id: true, name: true } },
      tasks: { select: { status: true } },
    },
  });

  return (
    <div>
      <FadeIn>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            <p className="mt-1 text-sm text-slate-500">All projects across clients, with budget, deadline, and task progress.</p>
          </div>
          <Link href="/onboard" className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">
            + Onboard Client
          </Link>
        </div>
      </FadeIn>

      <FadeIn delay={0.06}>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {projects.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No projects yet.{' '}
              <Link href="/onboard" className="font-medium text-brand hover:underline">Onboard your first client</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 font-medium">Client</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Budget</th>
                    <th className="px-5 py-3 font-medium">Deadline</th>
                    <th className="px-5 py-3 font-medium">Progress</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projects.map((p) => {
                    const total = p.tasks.length;
                    const done = p.tasks.filter((t) => t.status === 'DONE').length;
                    const pct = total ? Math.round((done / total) * 100) : 0;
                    return (
                      <tr key={p.id} className="transition hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-brand">
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <Link href={`/clients/${p.client.id}`} className="text-slate-500 hover:text-brand">
                            {p.client.name}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-slate-500">{PROJECT_TYPE_LABELS[p.type] ?? p.type}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status] ?? ''}`}>
                            {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                          {p.budgetAmount != null ? formatMoney(p.budgetAmount, p.budgetCurrency ?? 'USD') : '—'}
                        </td>
                        <td className="px-5 py-3 tabular-nums text-slate-500">{fmtDate(p.deadline)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-brand'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-xs tabular-nums text-slate-400">
                              {total ? `${done}/${total}` : '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <RowActions
                            viewHref={`/projects/${p.id}`}
                            editHref={`/projects/${p.id}/edit`}
                            deleteAction={deleteProject.bind(null, p.id)}
                            label="project"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
