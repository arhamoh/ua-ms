import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PROJECT_STATUS_LABELS, STATUS_BADGE, PROJECT_TYPE_LABELS } from '@/lib/enums';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' },
    include: { projects: { orderBy: { createdAt: 'desc' } } },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">All onboarded clients and their projects.</p>
        </div>
        <Link
          href="/onboard"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + Onboard Client
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">No clients yet.</p>
          <Link
            href="/onboard"
            className="mt-3 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Onboard your first client
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold">{c.name}</h2>
                  <p className="text-sm text-slate-500">
                    {[c.contactName, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {c.projects.length} project{c.projects.length === 1 ? '' : 's'}
                </span>
              </div>

              {c.projects.length > 0 && (
                <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                  {c.projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="flex items-center justify-between py-2.5 hover:bg-slate-50"
                    >
                      <span className="text-sm font-medium text-brand">{p.name}</span>
                      <span className="flex items-center gap-2 text-xs text-slate-500">
                        {PROJECT_TYPE_LABELS[p.type] ?? p.type}
                        <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[p.status] ?? ''}`}>
                          {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
