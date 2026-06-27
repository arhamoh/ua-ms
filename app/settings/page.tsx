import { Database, FileText, Trash2, SlidersHorizontal, Plus, X, Building2, Plug, Clock } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { seedDemoData, backfillInvoices, clearDemoData, addOption, deleteOption, saveCompanySettings } from '@/app/actions';
import { saveMyTimezone } from './actions';
import TimezoneSelect from '@/components/TimezoneSelect';
import { ensureOptionsSeeded, ensureOptionDefaults, OPTION_KINDS } from '@/lib/options';
import { getIntegrations } from '@/lib/integrations';
import { getCompany } from '@/lib/company';
import { getSession } from '@/lib/auth';
import FadeIn from '@/components/FadeIn';
import IntegrationsPanel from '@/components/IntegrationsPanel';
import SettingsTabs, { type SettingsTab } from '@/components/SettingsTabs';
import MigrationButton from '@/components/MigrationButton';

export const dynamic = 'force-dynamic';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

const MESSAGES: Record<string, string> = {
  seeded: 'Demo data added — explore the dashboard, finance, commissions, and invoices.',
  cleared: 'Demo data removed.',
  invoices: 'Generated invoices for any projects that were missing one.',
  company: 'Company details saved.',
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  const { done } = await searchParams;
  await ensureOptionsSeeded();
  // Surface newer built-in defaults (e.g. Wise/Remitly) on already-seeded DBs.
  await Promise.all(OPTION_KINDS.map((k) => ensureOptionDefaults(k.kind)));
  const allOptions = await prisma.optionItem.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
  const byKind: Record<string, typeof allOptions> = {};
  for (const o of allOptions) (byKind[o.kind] ??= []).push(o);
  const company = await getCompany();
  const integrations = await getIntegrations();
  const session = await getSession();
  const isSuperAdmin = !!session?.roles?.includes('SUPER_ADMIN');
  const me = session ? await prisma.user.findUnique({ where: { id: session.id }, select: { timezone: true } }) : null;

  const preferencesTab: SettingsTab = {
    id: 'preferences',
    label: 'Your timezone',
    icon: <Clock size={15} />,
    content: (
      <form action={saveMyTimezone} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-brand" />
          <h2 className="text-sm font-semibold">Your timezone</h2>
        </div>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          Set where you work. Teammates in other timezones will see your local time as a live clock in
          their header — and you&apos;ll see theirs.
        </p>
        <div className="mt-4 block max-w-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Timezone</span>
          <TimezoneSelect name="timezone" defaultValue={me?.timezone ?? ''} />
        </div>
        <button className="mt-4 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">
          Save timezone
        </button>
      </form>
    ),
  };

  const databaseTab: SettingsTab = {
    id: 'database',
    label: 'Database',
    icon: <Database size={15} />,
    content: (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-brand" />
          <h2 className="text-sm font-semibold">Database migrations</h2>
        </div>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          Applies any pending schema migrations to the live database (`prisma migrate deploy`).
          Deploys run this automatically — use this if a new feature&apos;s table isn&apos;t there yet,
          without waiting for a redeploy. It only applies committed migrations; it never resets data.
        </p>
        <div className="mt-4">
          <MigrationButton variant="full" />
        </div>
      </div>
    ),
  };

  return (
    <div className="max-w-4xl">
      <FadeIn>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Integrations, company details, dropdown options, and demo data.</p>
      </FadeIn>

      {done && MESSAGES[done] && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{MESSAGES[done]}</div>
      )}

      <SettingsTabs
        tabs={[
          preferencesTab,
          {
            id: 'integrations',
            label: 'Integrations',
            icon: <Plug size={15} />,
            content: (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Plug size={18} className="text-brand" />
                  <h2 className="text-sm font-semibold">Integrations &amp; connections</h2>
                  <span className="text-xs text-slate-400">What’s connected, and whether the keys work</span>
                </div>
                <IntegrationsPanel integrations={integrations} />
                <p className="mt-2 text-xs text-slate-400">
                  Keys are set in Railway → <span className="font-medium text-slate-500">ua-ms</span> service → Variables.
                  Secret values are never shown here — only whether each one is set.
                </p>
              </div>
            ),
          },
          {
            id: 'company',
            label: 'Company',
            icon: <Building2 size={15} />,
            content: (
              <form action={saveCompanySettings} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-brand" />
                  <h2 className="text-sm font-semibold">Company details</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">Used on invoices, receipts, and contracts.</p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium text-slate-600">Company name</span><input name="name" defaultValue={company.name} className={inputCls} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Email</span><input name="email" type="email" defaultValue={company.email ?? ''} className={inputCls} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Phone</span><input name="phone" defaultValue={company.phone ?? ''} className={inputCls} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Website</span><input name="website" defaultValue={company.website ?? ''} className={inputCls} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Address</span><input name="address" defaultValue={company.address ?? ''} className={inputCls} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">GST number</span><input name="gstNumber" defaultValue={company.gstNumber ?? ''} className={inputCls} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">QST number</span><input name="qstNumber" defaultValue={company.qstNumber ?? ''} className={inputCls} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">NEQ number</span><input name="neqNumber" defaultValue={company.neqNumber ?? ''} className={inputCls} /></label>
                  <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:max-w-xs">
                    <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">GST rate (%)</span><input name="gstRate" type="number" step="any" min="0" defaultValue={company.gstRate} className={inputCls} /></label>
                    <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">QST rate (%)</span><input name="qstRate" type="number" step="any" min="0" defaultValue={company.qstRate} className={inputCls} /></label>
                  </div>
                </div>
                <button className="mt-4 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">Save company details</button>
              </form>
            ),
          },
          {
            id: 'options',
            label: 'Dropdown options',
            icon: <SlidersHorizontal size={15} />,
            content: (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-brand" />
                  <h2 className="text-sm font-semibold">Dropdown options</h2>
                  <span className="text-xs text-slate-400">Customize the choices used across the app</span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {OPTION_KINDS.map((k) => {
                    const items = byKind[k.kind] ?? [];
                    return (
                      <div key={k.kind} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k.label}</h3>

                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {items.length === 0 && <span className="text-xs text-slate-400">None yet</span>}
                          {items.map((it) => (
                            <span
                              key={it.id}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-xs text-slate-700"
                            >
                              {it.label}
                              {it.rate != null && <span className="text-slate-400">· {it.rate}%</span>}
                              <form action={deleteOption}>
                                <input type="hidden" name="id" value={it.id} />
                                <button
                                  className="grid h-4 w-4 place-items-center rounded-full text-slate-300 transition hover:bg-rose-100 hover:text-rose-600"
                                  aria-label={`Remove ${it.label}`}
                                >
                                  <X size={11} />
                                </button>
                              </form>
                            </span>
                          ))}
                        </div>

                        <form action={addOption} className="mt-3 flex items-center gap-1.5">
                          <input type="hidden" name="kind" value={k.kind} />
                          <input
                            name="label"
                            required
                            placeholder={k.kind === 'currency' ? 'Add code…' : 'Add option…'}
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
                          />
                          {k.hasRate && (
                            <input
                              name="rate"
                              type="number"
                              step="any"
                              min="0"
                              placeholder="%"
                              className="w-14 shrink-0 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
                            />
                          )}
                          <button
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-white transition hover:bg-brand-dark"
                            aria-label="Add"
                          >
                            <Plus size={15} />
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              </div>
            ),
          },
          {
            id: 'demo',
            label: 'Demo data',
            icon: <Database size={15} />,
            content: (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <Database size={18} className="text-brand" />
                  <h2 className="text-sm font-semibold">Demo data</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Populate the platform with a full set of sample clients, projects, team members, tasks,
                  payments, invoices, expenses, salaries, and commissions. Demo records are prefixed “Demo —”.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={seedDemoData}>
                    <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">
                      <Database size={15} /> Add demo data
                    </button>
                  </form>
                  <form action={backfillInvoices}>
                    <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <FileText size={15} /> Generate missing invoices
                    </button>
                  </form>
                  <form action={clearDemoData}>
                    <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50">
                      <Trash2 size={15} /> Clear demo data
                    </button>
                  </form>
                </div>
              </div>
            ),
          },
          ...(isSuperAdmin ? [databaseTab] : []),
        ]}
      />
    </div>
  );
}
