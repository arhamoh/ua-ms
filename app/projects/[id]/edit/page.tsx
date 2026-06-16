import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { updateProject } from '@/app/actions';
import ProjectFields from '@/components/ProjectFields';
import AnimatedButton from '@/components/AnimatedButton';

export const dynamic = 'force-dynamic';

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, users] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: { client: { select: { id: true, name: true } }, members: { select: { userId: true, role: true } } },
    }),
    prisma.user.findMany({ orderBy: { name: 'asc' } }),
  ]);

  if (!project) notFound();

  const assigned = {
    pm: project.members.filter((m) => m.role === 'PROJECT_MANAGER').map((m) => m.userId),
    dev: project.members.filter((m) => m.role === 'DEVELOPER').map((m) => m.userId),
    designer: project.members.filter((m) => m.role === 'DESIGNER').map((m) => m.userId),
  };

  return (
    <div>
      <Link
        href={`/projects/${project.id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
      >
        <ArrowLeft size={14} /> {project.name}
      </Link>
      <div className="mb-6 mt-2">
        <h1 className="text-2xl font-bold tracking-tight">Edit project</h1>
        <p className="mt-1 text-sm text-slate-500">
          Client: <span className="font-medium text-slate-700">{project.client.name}</span>
        </p>
      </div>

      <form action={updateProject} className="space-y-6">
        <input type="hidden" name="projectId" value={project.id} />
        <ProjectFields users={users} initial={project} assigned={assigned} />

        <div className="flex items-center justify-end gap-3">
          <Link href={`/projects/${project.id}`} className="rounded-xl px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </Link>
          <AnimatedButton
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-dark"
          >
            Save changes
          </AnimatedButton>
        </div>
      </form>
    </div>
  );
}
