import {
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  BUDGET_TYPES,
  BUDGET_TYPE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  CURRENCIES,
} from '@/lib/enums';

export const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

export function Field({
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

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

type TeamUser = { id: string; name: string; roles: string[] };

// The project-specific sections, shared by onboarding and "add project to client".
// Field names match the onboardClient / addProjectToClient server actions.
export default function ProjectFields({ users }: { users: TeamUser[] }) {
  const pms = users.filter((u) => u.roles.includes('PROJECT_MANAGER'));
  const devs = users.filter((u) => u.roles.includes('DEVELOPER'));
  const designers = users.filter((u) => u.roles.includes('DESIGNER'));

  return (
    <>
      <SectionCard title="Project Overview">
        <Field label="Project name" required>
          <input name="projectName" required className={inputCls} placeholder="Website redesign" />
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
    </>
  );
}
