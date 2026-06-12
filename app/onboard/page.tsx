import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { onboardClient } from '@/app/actions';
import {
  CLIENT_SOURCES,
  CLIENT_SOURCE_LABELS,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  BUDGET_TYPES,
  BUDGET_TYPE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  CURRENCIES,
} from '@/lib/enums';

export const dynamic = 'force-dynamic';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default async function OnboardPage() {
  const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
  const pms = users.filter((u) => u.roles.includes('PROJECT_MANAGER' as any));
  const devs = users.filter((u) => u.roles.includes('DEVELOPER' as any));
  const designers = users.filter((u) => u.roles.includes('DESIGNER' as any));

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
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
        </SectionCard>

        <SectionCard title="Project Overview">
          <Field label="Project name" required>
            <input name="projectName" required className={inputCls} placeholder="Acme website redesign" />
          </Field>
          <Field label="Project type" required>
            <select name="projectType" required className={inputCls} defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              {PROJECT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROJECT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description / goals">
              <textarea name="description" rows={3} className={inputCls} placeholder="What are we building and why?" />
            </Field>
          </div>
          <Field label="Target audience">
            <input name="targetAudience" className={inputCls} placeholder="Who is this for?" />
          </Field>
          <Field label="References / inspiration">
            <input name="referenceLinks" className={inputCls} placeholder="Links to examples" />
          </Field>
        </SectionCard>

        <SectionCard title="Scope · Budget · Timeline">
          <Field label="Budget amount">
            <input name="budgetAmount" type="number" min="0" step="any" className={inputCls} placeholder="5000" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Currency">
              <select name="budgetCurrency" className={inputCls} defaultValue="USD">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Budget type">
              <select name="budgetType" className={inputCls} defaultValue="">
                <option value="">—</option>
                {BUDGET_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {BUDGET_TYPE_LABELS[b]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Start date">
            <input name="startDate" type="date" className={inputCls} />
          </Field>
          <Field label="Deadline">
            <input name="deadline" type="date" className={inputCls} />
          </Field>
          <Field label="Priority">
            <select name="priority" className={inputCls} defaultValue="MEDIUM">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
        </SectionCard>

        <SectionCard title="Assets & Links">
          <Field label="Figma link" hint="For design / dev projects">
            <input name="figmaLink" className={inputCls} placeholder="https://figma.com/…" />
          </Field>
          <Field label="Brand assets / guidelines">
            <input name="brandAssetsLink" className={inputCls} placeholder="Link to brand kit" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Project files" hint="Paste links (Drive, Dropbox, etc.) — one per line">
              <textarea name="fileLinks" rows={2} className={inputCls} placeholder="https://drive.google.com/…" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Domain / hosting access" hint="For development projects">
              <input name="domainAccess" className={inputCls} placeholder="Registrar, host, access notes" />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Assignment (internal)">
          <Field label="Project Manager(s)" hint="Ctrl/Cmd-click to select multiple">
            <select name="pmIds" multiple className={`${inputCls} h-28`}>
              {pms.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Developer(s)" hint="Ctrl/Cmd-click to select multiple">
            <select name="devIds" multiple className={`${inputCls} h-28`}>
              {devs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Designer(s)" hint="Ctrl/Cmd-click to select multiple">
            <select name="designerIds" multiple className={`${inputCls} h-28`}>
              {designers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Internal notes">
              <textarea name="internalNotes" rows={2} className={inputCls} placeholder="Anything the team should know" />
            </Field>
          </div>
        </SectionCard>

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
