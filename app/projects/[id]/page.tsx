import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  PROJECT_STATUS_LABELS,
  STATUS_BADGE,
  PROJECT_TYPE_LABELS,
  PRIORITY_LABELS,
  BUDGET_TYPE_LABELS,
  CLIENT_SOURCE_LABELS,
  PROJECT_ROLE_LABELS,
} from '@/lib/enums';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date | null) {
  if (!d) return '—';
  return new Date(d).toISOString().split('T')[0];
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-48 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-700">{value || '—'}</dd>
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { client: true, members: { include: { user: true } } },
  });

  if (!project) notFound();

  const byRole = (role: string) =>
    project.members.filter((m) => m.role === role).map((m) => m.user.name);

  const budget =
    project.budgetAmount != null
      ? `${project.budgetCurrency ?? ''} ${project.budgetAmount.toLocaleString()}${
          project.budgetType ? ` (${BUDGET_TYPE_LABELS[project.budgetType]})` : ''
        }`
      : '—';

  const c = project.client;

  return (
    <div>
      <div className="mb-6">
        <Link href="/clients" className="text-sm text-slate-500 hover:underline">
          ← Clients
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[project.status] ?? ''}`}>
            {PROJECT_STATUS_LABELS[project.status] ?? project.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {PROJECT_TYPE_LABELS[project.type] ?? project.type} · for{' '}
          <span className="font-medium text-slate-700">{c.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Project</h2>
          <dl className="divide-y divide-slate-100">
            <Row label="Description" value={project.description} />
            <Row label="Target audience" value={project.targetAudience} />
            <Row label="References" value={project.referenceLinks} />
            <Row label="Budget" value={budget} />
            <Row label="Priority" value={PRIORITY_LABELS[project.priority]} />
            <Row label="Start date" value={fmtDate(project.startDate)} />
            <Row label="Deadline" value={fmtDate(project.deadline)} />
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Client</h2>
          <dl className="divide-y divide-slate-100">
            <Row label="Business" value={c.name} />
            <Row label="Contact" value={c.contactName} />
            <Row label="Email" value={c.email} />
            <Row label="Phone" value={c.phone} />
            <Row label="Source" value={c.source ? CLIENT_SOURCE_LABELS[c.source] : null} />
            <Row label="Industry" value={c.industry} />
            <Row label="Location" value={c.location} />
            <Row label="Website" value={c.website} />
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Assets & Links</h2>
          <dl className="divide-y divide-slate-100">
            <Row label="Figma" value={project.figmaLink} />
            <Row label="Brand assets" value={project.brandAssetsLink} />
            <Row label="Files" value={project.fileLinks ? <span className="whitespace-pre-line">{project.fileLinks}</span> : null} />
            <Row label="Domain / hosting" value={project.domainAccess} />
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Team & Notes</h2>
          <dl className="divide-y divide-slate-100">
            <Row label={PROJECT_ROLE_LABELS.PROJECT_MANAGER} value={byRole('PROJECT_MANAGER').join(', ')} />
            <Row label={PROJECT_ROLE_LABELS.DEVELOPER} value={byRole('DEVELOPER').join(', ')} />
            <Row label={PROJECT_ROLE_LABELS.DESIGNER} value={byRole('DESIGNER').join(', ')} />
            <Row label="Internal notes" value={project.internalNotes} />
          </dl>
        </section>
      </div>
    </div>
  );
}
