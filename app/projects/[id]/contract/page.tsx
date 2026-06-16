import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCompany } from '@/lib/company';
import { PROJECT_TYPE_LABELS, formatMoney } from '@/lib/enums';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

function fmt(d: Date | null) {
  return d ? new Date(d).toISOString().slice(0, 10) : '__________';
}

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, company] = await Promise.all([
    prisma.project.findUnique({ where: { id }, include: { client: true } }),
    getCompany(),
  ]);
  if (!project) notFound();
  const c = project.client;
  const budget = project.budgetAmount != null ? formatMoney(project.budgetAmount, project.budgetCurrency ?? 'USD') : '__________';

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> {project.name}
        </Link>
        <PrintButton label="Print / Download PDF" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm leading-relaxed shadow-sm print:border-0 print:shadow-none">
        <div className="border-b-2 border-brand pb-4 text-center">
          <div className="text-xl font-bold">{company.name}</div>
          <div className="mt-1 text-lg font-semibold tracking-wide text-brand">SERVICE AGREEMENT</div>
        </div>

        <p className="mt-6 text-slate-700">
          This Service Agreement (“Agreement”) is entered into between{' '}
          <strong>{company.name}</strong>
          {company.address ? `, ${company.address}` : ''} (the “Provider”), and{' '}
          <strong>{c.name}</strong>
          {c.contactName ? `, represented by ${c.contactName}` : ''} (the “Client”), for the project
          described below.
        </p>

        <h3 className="mt-6 font-semibold">1. Project</h3>
        <p className="text-slate-700">
          <strong>{project.name}</strong> — {PROJECT_TYPE_LABELS[project.type] ?? project.type}.
          {project.description ? ` ${project.description}` : ''}
        </p>

        <h3 className="mt-4 font-semibold">2. Scope of Work</h3>
        <p className="text-slate-700">
          The Provider agrees to deliver the services described above. Any work beyond this scope will
          be quoted and agreed separately in writing.
        </p>

        <h3 className="mt-4 font-semibold">3. Fees</h3>
        <p className="text-slate-700">
          The total project fee is <strong>{budget}</strong>, plus applicable taxes (GST/QST where
          required), invoiced per the agreed schedule. Payment is due within 15 days of each invoice.
        </p>

        <h3 className="mt-4 font-semibold">4. Timeline</h3>
        <p className="text-slate-700">
          Start date: <strong>{fmt(project.startDate)}</strong>. Target completion:{' '}
          <strong>{fmt(project.deadline)}</strong>. Timelines depend on timely Client feedback and
          materials.
        </p>

        <h3 className="mt-4 font-semibold">5. General Terms</h3>
        <p className="text-slate-700">
          Ownership of final deliverables transfers to the Client upon full payment. Either party may
          terminate with written notice; the Client remains responsible for work completed to date.
          This Agreement is governed by the laws of the Province of Quebec, Canada.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-8">
          <div>
            <div className="h-10 border-b border-slate-400" />
            <div className="mt-1 text-xs text-slate-500">{company.name} (Provider)</div>
          </div>
          <div>
            <div className="h-10 border-b border-slate-400" />
            <div className="mt-1 text-xs text-slate-500">{c.name} (Client)</div>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-400 print:hidden">
          Draft agreement generated from project data. Replace with your standard template anytime.
        </p>
      </div>
    </div>
  );
}
