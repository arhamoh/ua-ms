import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { addProjectToClient } from '@/app/actions';
import { projectSections } from '@/components/ProjectFields';
import OnboardWizard, { type WizardStep } from '@/components/OnboardWizard';

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

  const projSecs = await projectSections({ users });
  const byId = (sid: string) => projSecs.find((s) => s.id === sid)?.node;
  const steps: WizardStep[] = [
    {
      id: 'project',
      label: 'Project',
      content: (
        <>
          {byId('overview')}
          {byId('scope')}
        </>
      ),
    },
    {
      id: 'team',
      label: 'Assets & Team',
      content: (
        <>
          {byId('assets')}
          {byId('assignment')}
        </>
      ),
    },
  ];

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
          billing history — one step at a time.
        </p>
      </div>

      <form action={addProjectToClient}>
        <input type="hidden" name="clientId" value={client.id} />
        <OnboardWizard steps={steps} submitLabel="Create project" cancelHref={`/clients/${client.id}`} />
      </form>
    </div>
  );
}
