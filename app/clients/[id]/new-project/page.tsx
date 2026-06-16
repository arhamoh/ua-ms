import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { addProjectToClient } from '@/app/actions';
import ProjectFields from '@/components/ProjectFields';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, users] = await Promise.all([
    prisma.client.findUnique({ where: { id }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { name: 'asc' } }),
  ]);

  if (!client) notFound();

  return (
    <div>
      <Link
        href={`/clients/${client.id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
      >
        <ArrowLeft size={14} /> {client.name}
      </Link>
      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">New project</h1>
        <p className="mt-1 text-sm text-slate-500">
          Added to <span className="font-medium text-slate-700">{client.name}</span> and their
          billing history.
        </p>
      </div>

      <form action={addProjectToClient} className="space-y-6">
        <input type="hidden" name="clientId" value={client.id} />
        <ProjectFields users={users} />

        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/clients/${client.id}`}
            className="rounded-xl px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
          >
            Create project
          </button>
        </div>
      </form>
    </div>
  );
}
