import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { updateClient } from '@/app/actions';
import { SectionCard, Field, inputCls } from '@/components/ProjectFields';
import AnimatedButton from '@/components/AnimatedButton';
import { getOptions } from '@/lib/options';
import { TAX_REGIONS } from '@/lib/company';

export const dynamic = 'force-dynamic';

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, users, sources, leadTypes] = await Promise.all([
    prisma.client.findUnique({ where: { id } }),
    prisma.user.findMany({ orderBy: { name: 'asc' } }),
    getOptions('clientSource'),
    getOptions('leadType'),
  ]);

  if (!client) notFound();

  return (
    <div>
      <Link
        href={`/clients/${client.id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
      >
        <ArrowLeft size={14} /> {client.name}
      </Link>
      <div className="mb-6 mt-2">
        <h1 className="text-2xl font-bold tracking-tight">Edit client</h1>
        <p className="mt-1 text-sm text-slate-500">Update contact, source and billing details.</p>
      </div>

      <form action={updateClient} className="space-y-6">
        <input type="hidden" name="clientId" value={client.id} />
        <SectionCard title="Client / Contact">
          <Field label="Client / business name" required>
            <input name="name" required defaultValue={client.name} className={inputCls} placeholder="Acme Inc." />
          </Field>
          <Field label="Primary contact name">
            <input name="contactName" defaultValue={client.contactName ?? ''} className={inputCls} placeholder="Jane Doe" />
          </Field>
          <Field label="Client email">
            <input name="clientEmail" type="email" defaultValue={client.email ?? ''} className={inputCls} placeholder="jane@acme.com" />
          </Field>
          <Field label="Client phone">
            <input name="clientPhone" defaultValue={client.phone ?? ''} className={inputCls} placeholder="+1 555 123 4567" />
          </Field>
          <Field label="Source" hint="How they found us">
            <select name="source" className={inputCls} defaultValue={client.source ?? ''}>
              <option value="">Select…</option>
              {sources.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Source detail" hint="If 'Other', specify">
            <input name="sourceOther" defaultValue={client.sourceOther ?? ''} className={inputCls} placeholder="e.g. LinkedIn" />
          </Field>
          <Field label="Industry / niche">
            <input name="industry" defaultValue={client.industry ?? ''} className={inputCls} placeholder="E-commerce" />
          </Field>
          <Field label="Location" hint="Optional">
            <input name="location" defaultValue={client.location ?? ''} className={inputCls} placeholder="Toronto, CA" />
          </Field>
          <Field label="Current website">
            <input name="website" defaultValue={client.website ?? ''} className={inputCls} placeholder="https://acme.com" />
          </Field>
          <Field label="Social / other links">
            <input name="socialLinks" defaultValue={client.socialLinks ?? ''} className={inputCls} placeholder="@acme, linkedin.com/…" />
          </Field>
          <Field label="Salesperson" hint="Who brought this lead in (for commission)">
            <select name="salespersonId" className={inputCls} defaultValue={client.salespersonId ?? ''}>
              <option value="">None</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lead type" hint="Sets the sales commission rate">
            <select name="leadType" className={inputCls} defaultValue={client.leadType ?? ''}>
              <option value="">—</option>
              {leadTypes.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}{l.rate != null ? ` (${l.rate}%)` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tax region" hint="Determines invoice tax (GST/QST)">
            <select name="taxRegion" className={inputCls} defaultValue={client.taxRegion ?? ''}>
              <option value="">No tax / US</option>
              {TAX_REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
        </SectionCard>

        <div className="flex items-center justify-end gap-3">
          <Link href={`/clients/${client.id}`} className="rounded-xl px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100">
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
