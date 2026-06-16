import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, TrendingUp, Wallet, Scale } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { deleteCommissionPayout } from '@/app/actions';
import {
  ROLE_LABELS,
  SALES_COMMISSION_RATE,
  PROJECT_STATUS_LABELS,
  STATUS_BADGE,
  formatMoney,
} from '@/lib/enums';
import { getRatesToCad, toCad } from '@/lib/fx';
import { getLeadTypeRates } from '@/lib/options';
import FadeIn from '@/components/FadeIn';
import Pill from '@/components/Pill';
import RowActions from '@/components/RowActions';

export const dynamic = 'force-dynamic';

const isPipeline = (status: string) => status !== 'COMPLETED' && status !== 'ARCHIVED';

type Line = {
  key: string;
  project: string;
  projectId?: string;
  client: string;
  source: 'Sales' | 'PM';
  status?: string;
  ratePct: number;
  rateNote?: string;
  valueCad: number;
  paymentsCad: number;
  projected: number;
  earned: number;
};

export default async function CommissionPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, rates, leadRates] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        salesLeads: { include: { projects: true, payments: true } },
        projectMembers: {
          where: { role: 'PROJECT_MANAGER' },
          include: { project: { include: { payments: true, members: { where: { role: 'PROJECT_MANAGER' } } } } },
        },
        commissionPayouts: { orderBy: { paidAt: 'desc' } },
      },
    }),
    getRatesToCad(),
    getLeadTypeRates(),
  ]);

  if (!user) notFound();

  const cad = (amt: number | null, cur: string | null) => toCad(amt ?? 0, cur, rates);
  const lines: Line[] = [];

  // Sales commission — % of the client's project value / payments received.
  for (const client of user.salesLeads) {
    const lt = client.leadType ?? '';
    const ratePct = leadRates[lt] ?? SALES_COMMISSION_RATE[lt] ?? 0;
    const rate = ratePct / 100;

    // Group this client's payments by project (null = general / unassigned).
    const payByProject: Record<string, number> = {};
    for (const pay of client.payments) {
      const k = pay.projectId ?? '__general__';
      payByProject[k] = (payByProject[k] ?? 0) + (pay.amountCad ?? cad(pay.amount, pay.currency));
    }

    for (const p of client.projects) {
      const valueCad = cad(p.budgetAmount, p.budgetCurrency);
      const paymentsCad = payByProject[p.id] ?? 0;
      lines.push({
        key: `sales-${p.id}`,
        project: p.name,
        projectId: p.id,
        client: client.name,
        source: 'Sales',
        status: p.status,
        ratePct,
        valueCad,
        paymentsCad,
        projected: isPipeline(p.status) ? valueCad * rate : 0,
        earned: paymentsCad * rate,
      });
    }

    // Client payments not tied to a project still earn sales commission.
    const general = payByProject['__general__'] ?? 0;
    if (general > 0.01) {
      lines.push({
        key: `sales-general-${client.id}`,
        project: 'General / unassigned',
        client: client.name,
        source: 'Sales',
        ratePct,
        valueCad: 0,
        paymentsCad: general,
        projected: 0,
        earned: general * rate,
      });
    }
  }

  // PM commission — % of project value / payments, split across PMs on the project.
  for (const pm of user.projectMembers) {
    const proj = pm.project;
    const numPMs = Math.max(1, proj.members.length);
    const ratePct = proj.pmCommissionRate ?? 0;
    const rate = ratePct / 100;
    const valueCad = cad(proj.budgetAmount, proj.budgetCurrency) / numPMs;
    const paymentsCad = proj.payments.reduce((s, pay) => s + (pay.amountCad ?? cad(pay.amount, pay.currency)), 0) / numPMs;
    lines.push({
      key: `pm-${proj.id}`,
      project: proj.name,
      projectId: proj.id,
      client: '',
      source: 'PM',
      status: proj.status,
      ratePct,
      rateNote: numPMs > 1 ? `split ${numPMs} PMs` : undefined,
      valueCad,
      paymentsCad,
      projected: isPipeline(proj.status) ? valueCad * rate : 0,
      earned: paymentsCad * rate,
    });
  }

  lines.sort((a, b) => b.earned - a.earned || b.projected - a.projected);

  const projected = lines.reduce((s, l) => s + l.projected, 0);
  const earned = lines.reduce((s, l) => s + l.earned, 0);
  const paid = user.commissionPayouts.reduce((s, p) => s + p.amount, 0);
  const outstanding = earned - paid;

  const summary = [
    { label: 'Projected (pipeline)', value: formatMoney(projected, 'CAD'), icon: TrendingUp, tint: 'bg-rose-50 text-rose-600' },
    { label: 'Earned (to date)', value: formatMoney(earned, 'CAD'), icon: Wallet, tint: 'bg-emerald-50 text-emerald-600' },
    { label: 'Paid out', value: formatMoney(paid, 'CAD'), icon: Wallet, tint: 'bg-slate-100 text-slate-500' },
    { label: 'Outstanding', value: formatMoney(outstanding, 'CAD'), icon: Scale, tint: outstanding > 0.01 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600' },
  ];

  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div>
      <FadeIn>
        <Link href="/commissions" className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700">
          <ArrowLeft size={14} /> Commissions
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {user.roles.map((x) => ROLE_LABELS[x] ?? x).join(', ') || 'No roles'} · commission breakdown in CAD
          </p>
        </div>
      </FadeIn>

      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary.map((s, i) => (
          <FadeIn key={s.label} delay={0.04 * i}>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${s.tint}`}><s.icon size={20} /></span>
              <div className="mt-4 text-xl font-semibold tracking-tight">{s.value}</div>
              <div className="mt-0.5 text-sm text-slate-500">{s.label}</div>
            </div>
          </FadeIn>
        ))}
      </section>

      {/* Per-project breakdown */}
      <FadeIn delay={0.1}>
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Commission by project</h2>
            <p className="mt-0.5 text-xs text-slate-400">The % rate applied and the $ earned per project (sales lead + PM).</p>
          </div>
          {lines.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              Not eligible for any commission yet. Assign them as a salesperson on a client, or a PM on a project.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Rate</th>
                    <th className="px-5 py-3 text-right font-medium">Project value</th>
                    <th className="px-5 py-3 text-right font-medium">Paid by client</th>
                    <th className="px-5 py-3 text-right font-medium">Projected</th>
                    <th className="px-5 py-3 text-right font-medium">Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l) => (
                    <tr key={l.key} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        {l.projectId ? (
                          <Link href={`/projects/${l.projectId}`} className="font-medium text-slate-800 hover:text-brand">
                            {l.project}
                          </Link>
                        ) : (
                          <span className="font-medium text-slate-800">{l.project}</span>
                        )}
                        {l.client && <div className="text-xs text-slate-400">{l.client}</div>}
                      </td>
                      <td className="px-5 py-3">
                        <Pill className={l.source === 'Sales' ? 'bg-pink-100 text-pink-700' : 'bg-indigo-100 text-indigo-700'}>
                          {l.source}
                        </Pill>
                      </td>
                      <td className="px-5 py-3">
                        {l.status ? (
                          <Pill className={STATUS_BADGE[l.status] ?? 'bg-slate-100 text-slate-600'}>
                            {PROJECT_STATUS_LABELS[l.status] ?? l.status}
                          </Pill>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        <div className="font-medium">{l.ratePct}%</div>
                        {l.rateNote && <div className="text-xs text-slate-400">{l.rateNote}</div>}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-500">
                        {l.valueCad > 0 ? formatMoney(l.valueCad, 'CAD') : '—'}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-500">
                        {l.paymentsCad > 0 ? formatMoney(l.paymentsCad, 'CAD') : '—'}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-500">{formatMoney(l.projected, 'CAD')}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums text-emerald-600">{formatMoney(l.earned, 'CAD')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <td className="px-5 py-3" colSpan={6}>Total</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(projected, 'CAD')}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(earned, 'CAD')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </FadeIn>

      {/* Payout history */}
      <FadeIn delay={0.14}>
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Payout history</h2>
            <span className="text-xs text-slate-400">{formatMoney(paid, 'CAD')} paid total</span>
          </div>
          {user.commissionPayouts.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No payouts recorded yet. Record one from the{' '}
              <Link href="/commissions" className="font-medium text-brand hover:underline">Commissions</Link> page.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Method</th>
                    <th className="px-5 py-3 font-medium">Note</th>
                    <th className="px-5 py-3 text-right font-medium">Amount</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {user.commissionPayouts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 tabular-nums text-slate-600">{fmtDate(p.paidAt)}</td>
                      <td className="px-5 py-3 text-slate-500">{p.method || '—'}</td>
                      <td className="px-5 py-3 text-slate-500">{p.note || '—'}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">{formatMoney(p.amount, 'CAD')}</td>
                      <td className="px-5 py-3">
                        <RowActions deleteAction={deleteCommissionPayout.bind(null, p.id)} label="payout" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
