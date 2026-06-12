import { prisma } from '@/lib/prisma';

// Read live data per-request; don't prerender (and hit the DB) at build time.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Smoke-test the DB connection. These return 0 until we add data in later phases.
  const [clients, projects, tasks, users] = await Promise.all([
    prisma.client.count(),
    prisma.project.count(),
    prisma.task.count(),
    prisma.user.count(),
  ]);

  const stats = [
    { label: 'Clients', value: clients },
    { label: 'Projects', value: projects },
    { label: 'Tasks', value: tasks },
    { label: 'Team members', value: users },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Agency Dashboard</h1>
        <p className="mt-2 text-slate-500">
          Foundation is live. Auth, clients, projects, tasks, and time tracking
          come in the next phases.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="text-3xl font-semibold text-brand">{s.value}</div>
            <div className="mt-1 text-sm text-slate-500">{s.label}</div>
          </div>
        ))}
      </section>

      <p className="mt-10 text-sm text-slate-400">
        ✅ Database connected via Prisma.
      </p>
    </main>
  );
}
