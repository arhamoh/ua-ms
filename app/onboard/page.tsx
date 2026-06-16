import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { onboardClient } from '@/app/actions';
import { projectSections, SectionCard, Field, inputCls } from '@/components/ProjectFields';
import OnboardWizard, { type WizardStep } from '@/components/OnboardWizard';
import { getOptions } from '@/lib/options';
import { TAX_REGIONS } from '@/lib/company';

export const dynamic = 'force-dynamic';

export default async function OnboardPage() {
  const [users, sources, leadTypes] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: 'asc' } }),
    getOptions('clientSource'),
    getOptions('leadType'),
  ]);
  const noTeam = users.length === 0;
  const projSecs = await projectSections({ users });

  // Client info is split into three short steps so no screen is overwhelming.
  const contactStep = (
    <SectionCard title="Client / Contact">
      <Field label="Client / business name" required>
        <input name="clientName" required className={inputCls} placeholder="Acme Inc." />
      </Field>
      <Field label="Primary contact name">
        <input name="contactName" className={inputCls} placeholder="Jane Doe" />
      </Field>
      <Field label="Client email">
        <input name="clientEmail" type="email" className={inputCls} placeholder="jane@acme.com" />
      </Field>
      <Field label="Client phone">
        <input name="clientPhone" className={inputCls} placeholder="+1 555 123 4567" />
      </Field>
    </SectionCard>
  );

  const backgroundStep = (
    <SectionCard title="Background & Source">
      <Field label="Source" hint="How they found us">
        <select name="source" className={inputCls} defaultValue="">
          <option value="">Select…</option>
          {sources.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Source detail" hint="If 'Other', specify">
        <input name="sourceOther" className={inputCls} placeholder="e.g. LinkedIn" />
      </Field>
      <Field label="Industry / niche">
        <input name="industry" className={inputCls} placeholder="E-commerce" />
      </Field>
      <Field label="Location" hint="Optional">
        <input name="location" className={inputCls} placeholder="Toronto, CA" />
      </Field>
      <Field label="Current website">
        <input name="website" className={inputCls} placeholder="https://acme.com" />
      </Field>
      <Field label="Social / other links">
        <input name="socialLinks" className={inputCls} placeholder="@acme, linkedin.com/…" />
      </Field>
    </SectionCard>
  );

  const salesStep = (
    <SectionCard title="Sales & Tax">
      <Field label="Salesperson" hint="Who brought this lead in (for commission)">
        <select name="salespersonId" className={inputCls} defaultValue="">
          <option value="">None</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Lead type" hint="Sets the sales commission rate">
        <select name="leadType" className={inputCls} defaultValue="">
          <option value="">—</option>
          {leadTypes.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}{l.rate != null ? ` (${l.rate}%)` : ''}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tax region" hint="Determines invoice tax (GST/QST)">
        <select name="taxRegion" className={inputCls} defaultValue="">
          <option value="">No tax / US</option>
          {TAX_REGIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </Field>
    </SectionCard>
  );

  const steps: WizardStep[] = [
    { id: 'contact', label: 'Client', content: contactStep },
    { id: 'background', label: 'Background', content: backgroundStep },
    { id: 'sales', label: 'Sales', content: salesStep },
    ...projSecs.map((s) => ({ id: s.id, label: s.short, content: s.node })),
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Onboard a client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add the client and their first project, one step at a time.
        </p>
      </div>

      {noTeam && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You haven’t added any team members yet, so the assignment lists will be empty.{' '}
          <Link href="/team" className="font-medium underline">
            Add your team
          </Link>{' '}
          first if you want to assign this project.
        </div>
      )}

      <form action={onboardClient}>
        <OnboardWizard steps={steps} submitLabel="Onboard client" cancelHref="/" />
      </form>
    </div>
  );
}
