import { Fragment } from 'react';
import {
  BUDGET_TYPES,
  BUDGET_TYPE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
} from '@/lib/enums';
import { getOptions } from '@/lib/options';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProjectInitial = Record<string, any> | undefined;

function dateValue(d: unknown): string {
  if (!d) return '';
  try {
    return new Date(d as string).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

// The project-specific sections, shared by onboarding, "add project to client",
// and the project edit form. Field names match the onboard/add/update actions.
// Pass `initial` (an existing project) + `assigned` role id-arrays to prefill.
//
// `projectSections` returns the four sections individually (with short labels) so
// the onboarding wizard can place each on its own step; `ProjectFields` renders
// them all together for the add/edit pages.
export async function projectSections({
  users,
  initial,
  assigned,
}: {
  users: TeamUser[];
  initial?: ProjectInitial;
  assigned?: { pm: string[]; dev: string[]; designer: string[] };
}): Promise<{ id: string; short: string; node: React.ReactNode }[]> {
  const [projectTypes, currencies] = await Promise.all([getOptions('projectType'), getOptions('currency')]);
  const pms = users.filter((u) => u.roles.includes('PROJECT_MANAGER'));
  const devs = users.filter((u) => u.roles.includes('DEVELOPER'));
  const designers = users.filter((u) => u.roles.includes('DESIGNER'));
  const a = assigned ?? { pm: [], dev: [], designer: [] };
  const v = (k: string): string => (initial?.[k] ?? '') as string;

  return [
    {
      id: 'overview',
      short: 'Project',
      node: (
      <SectionCard title="Project Overview">
        <Field label="Project name" required>
          <input name="projectName" required defaultValue={v('name')} className={inputCls} placeholder="Website redesign" />
        </Field>
        <Field label="Project type" required>
          <select name="projectType" required className={inputCls} defaultValue={v('type')}>
            <option value="" disabled>
              Select…
            </option>
            {projectTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description / goals">
            <textarea name="description" rows={3} defaultValue={v('description')} className={inputCls} placeholder="What are we building and why?" />
          </Field>
        </div>
        <Field label="Target audience">
          <input name="targetAudience" defaultValue={v('targetAudience')} className={inputCls} placeholder="Who is this for?" />
        </Field>
        <Field label="References / inspiration">
          <input name="referenceLinks" defaultValue={v('referenceLinks')} className={inputCls} placeholder="Links to examples" />
        </Field>
      </SectionCard>
      ),
    },
    {
      id: 'scope',
      short: 'Budget',
      node: (
      <SectionCard title="Scope · Budget · Timeline">
        <Field label="Budget amount">
          <input name="budgetAmount" type="number" min="0" step="any" defaultValue={v('budgetAmount')} className={inputCls} placeholder="5000" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Currency">
            <select name="budgetCurrency" className={inputCls} defaultValue={initial?.budgetCurrency ?? 'USD'}>
              {currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Budget type">
            <select name="budgetType" className={inputCls} defaultValue={v('budgetType')}>
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
          <input name="startDate" type="date" defaultValue={dateValue(initial?.startDate)} className={inputCls} />
        </Field>
        <Field label="Deadline">
          <input name="deadline" type="date" defaultValue={dateValue(initial?.deadline)} className={inputCls} />
        </Field>
        <Field label="Priority">
          <select name="priority" className={inputCls} defaultValue={initial?.priority ?? 'MEDIUM'}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
      </SectionCard>
      ),
    },
    {
      id: 'assets',
      short: 'Assets',
      node: (
      <SectionCard title="Assets & Links">
        <Field label="Figma link" hint="For design / dev projects">
          <input name="figmaLink" defaultValue={v('figmaLink')} className={inputCls} placeholder="https://figma.com/…" />
        </Field>
        <Field label="Brand assets / guidelines">
          <input name="brandAssetsLink" defaultValue={v('brandAssetsLink')} className={inputCls} placeholder="Link to brand kit" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Project files" hint="Paste links (Drive, Dropbox, etc.) — one per line">
            <textarea name="fileLinks" rows={2} defaultValue={v('fileLinks')} className={inputCls} placeholder="https://drive.google.com/…" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Domain / hosting access" hint="For development projects">
            <input name="domainAccess" defaultValue={v('domainAccess')} className={inputCls} placeholder="Registrar, host, access notes" />
          </Field>
        </div>
      </SectionCard>
      ),
    },
    {
      id: 'assignment',
      short: 'Team',
      node: (
      <SectionCard title="Assignment (internal)">
        <Field label="Project Manager(s)" hint="Ctrl/Cmd-click to select multiple">
          <select name="pmIds" multiple defaultValue={a.pm} className={`${inputCls} h-28`}>
            {pms.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Developer(s)" hint="Ctrl/Cmd-click to select multiple">
          <select name="devIds" multiple defaultValue={a.dev} className={`${inputCls} h-28`}>
            {devs.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Designer(s)" hint="Ctrl/Cmd-click to select multiple">
          <select name="designerIds" multiple defaultValue={a.designer} className={`${inputCls} h-28`}>
            {designers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="PM commission rate (%)" hint="Of project value / payments, to the PM">
          <input name="pmCommissionRate" type="number" min="0" step="any" defaultValue={initial?.pmCommissionRate ?? 10} className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Internal notes">
            <textarea name="internalNotes" rows={2} defaultValue={v('internalNotes')} className={inputCls} placeholder="Anything the team should know" />
          </Field>
        </div>
      </SectionCard>
      ),
    },
  ];
}

export default async function ProjectFields(props: {
  users: TeamUser[];
  initial?: ProjectInitial;
  assigned?: { pm: string[]; dev: string[]; designer: string[] };
}) {
  const sections = await projectSections(props);
  return (
    <>
      {sections.map((s) => (
        <Fragment key={s.id}>{s.node}</Fragment>
      ))}
    </>
  );
}
