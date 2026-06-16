import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { onboardClient } from '@/app/actions';
import { CLIENT_SOURCES, CLIENT_SOURCE_LABELS, LEAD_TYPES, LEAD_TYPE_LABELS } from '@/lib/enums';
import ProjectFields, { SectionCard, Field, inputCls } from '@/components/ProjectFields';

export const dynamic = 'force-dynamic';

export default async function OnboardPage() {
  const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
  const noTeam = users.length === 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Onboard a client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Creates the client and their first project in one step.
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

      <form action={onboardClient} className="space-y-6">
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
          <Field label="Source" hint="How they found us">
            <select name="source" className={inputCls} defaultValue="">
              <option value="">Select…</option>
              {CLIENT_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {CLIENT_SOURCE_LABELS[s]}
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
              {LEAD_TYPES.map((l) => (
                <option key={l} value={l}>{LEAD_TYPE_LABELS[l]}</option>
              ))}
            </select>
          </Field>
        </SectionCard>

        <ProjectFields users={users} />

        <div className="flex items-center justify-end gap-3">
          <Link href="/" className="rounded-xl px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
          >
            Onboard client
          </button>
        </div>
      </form>
    </div>
  );
}
