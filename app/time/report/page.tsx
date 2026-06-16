import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Clock, CalendarDays, Plus, Check, X } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { addAbsence, decideLeave, deleteLeave, deleteTimeEntry } from '@/app/actions';
import { LEAVE_TYPES, LEAVE_TYPE_LABELS, LEAVE_TYPE_BADGE, LEAVE_STATUS_BADGE, LEAVE_STATUS_LABELS } from '@/lib/enums';
import RowActions from '@/components/RowActions';
import Pill from '@/components/Pill';
import FadeIn from '@/components/FadeIn';

export const dynamic = 'force-dynamic';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';
const ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER'];
const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const fmtTime = (d: Date | null) => (d ? new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—');

function overlapDays(s: Date, e: Date, rangeStart: Date, rangeEnd: Date) {
  const a = Math.max(s.getTime(), rangeStart.getTime());
  const b = Math.min(e.getTime() + 86_400_000, rangeEnd.getTime());
  return b <= a ? 0 : Math.round((b - a) / 86_400_000);
}

function pct(active: number, total: number) {
  return total <= 0 ? null : Math.min(100, Math.round((active / total) * 100));
}
function pctTone(p: number) {
  return p >= 70 ? 'bg-emerald-100 text-emerald-700' : p >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
}

export default async function TimeReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.roles.some((r) => ADMIN_ROLES.includes(r))) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-800">
        Only admins and managers can view the team time report.{' '}
        <Link href="/time" className="font-medium underline">Back to your time</Link>.
      </div>
    );
  }

  const sp = await searchParams;
  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : defaultMonth;
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const monthLabel = start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const [users, entries, approvedLeaves, pending] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: 'asc' } }),
    prisma.timeEntry.findMany({
      where: { checkInAt: { gte: start, lt: end }, checkOutAt: { not: null } },
      include: { user: { select: { name: true } } },
      orderBy: { checkInAt: 'desc' },
    }),
    prisma.leaveRequest.findMany({
      where: { status: 'APPROVED', startDate: { lt: end }, endDate: { gte: start } },
    }),
    prisma.leaveRequest.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { name: true } } },
      orderBy: { startDate: 'asc' },
    }),
  ]);

  type Row = { id: string; name: string; hours: number; sessions: number; leaveDays: number; activeSeconds: number };
  const byUser = new Map<string, Row>();
  users.forEach((u) => byUser.set(u.id, { id: u.id, name: u.name, hours: 0, sessions: 0, leaveDays: 0, activeSeconds: 0 }));
  for (const e of entries) {
    const r = byUser.get(e.userId);
    if (r) { r.hours += e.hours ?? 0; r.sessions += 1; r.activeSeconds += e.activeSeconds; }
  }
  for (const l of approvedLeaves) {
    const r = byUser.get(l.userId);
    if (r) r.leaveDays += overlapDays(l.startDate, l.endDate, start, end);
  }
  const rows = [...byUser.values()].filter((r) => r.hours > 0 || r.sessions > 0 || r.leaveDays > 0);
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);

  const tabHref = (mo: string) => `/time/report?month=${mo}`;
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? 'Member';

  return (
    <div>
      <FadeIn>
        <Link href="/time" className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700">
          <ArrowLeft size={14} /> My time
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Team time report</h1>
            <p className="mt-1 text-sm text-slate-500">Hours logged and time off — {monthLabel}.</p>
          </div>
          <form className="flex items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Month</span>
              <input type="month" name="month" defaultValue={month} className={inputCls} />
            </label>
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">Go</button>
          </form>
        </div>
      </FadeIn>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <FadeIn delay={0.04}>
          <div className="mt-6 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
            <div className="border-b border-amber-100 bg-amber-50 px-5 py-3">
              <h2 className="text-sm font-semibold text-amber-900">{pending.length} request{pending.length === 1 ? '' : 's'} awaiting approval</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {pending.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800">{l.user.name}</span>
                      <Pill className={LEAVE_TYPE_BADGE[l.type] ?? 'bg-slate-100 text-slate-600'}>{LEAVE_TYPE_LABELS[l.type] ?? l.type}</Pill>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {fmtDate(l.startDate)}{fmtDate(l.endDate) !== fmtDate(l.startDate) ? ` → ${fmtDate(l.endDate)}` : ''}{l.reason ? ` · ${l.reason}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={decideLeave.bind(null, l.id, 'APPROVED')}>
                      <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                        <Check size={13} /> Approve
                      </button>
                    </form>
                    <form action={decideLeave.bind(null, l.id, 'REJECTED')}>
                      <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                        <X size={13} /> Reject
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Hours per member */}
        <FadeIn delay={0.08} className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Clock size={15} className="text-slate-400" /> Hours by member</h2>
              <span className="text-xs text-slate-400">{totalHours.toFixed(1)}h total</span>
            </div>
            {rows.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">No activity for {monthLabel}.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Member</th>
                      <th className="px-5 py-3 text-right font-medium">Sessions</th>
                      <th className="px-5 py-3 text-right font-medium">Hours</th>
                      <th className="px-5 py-3 text-right font-medium">Active</th>
                      <th className="px-5 py-3 text-right font-medium">Days off</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => {
                      const p = pct(r.activeSeconds, r.hours * 3600);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3 font-medium text-slate-800">{r.name}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-500">{r.sessions}</td>
                          <td className="px-5 py-3 text-right font-semibold tabular-nums">{r.hours.toFixed(1)}</td>
                          <td className="px-5 py-3 text-right">
                            {p != null ? (
                              <span className="inline-flex items-center gap-2">
                                <span className="tabular-nums text-slate-500">{(r.activeSeconds / 3600).toFixed(1)}h</span>
                                <Pill className={pctTone(p)}>{p}%</Pill>
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-500">{r.leaveDays || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <td className="px-5 py-3" colSpan={2}>Total</td>
                      <td className="px-5 py-3 text-right tabular-nums">{totalHours.toFixed(1)}</td>
                      <td className="px-5 py-3" colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </FadeIn>

        {/* Add absence */}
        <FadeIn delay={0.12}>
          <form action={addAbsence} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Plus size={16} className="text-brand" /> Mark absence / leave</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Member *</span>
                <select name="userId" required defaultValue="" className={inputCls}>
                  <option value="" disabled>Select…</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Type</span>
                <select name="type" defaultValue="ABSENT" className={inputCls}>
                  {LEAVE_TYPES.map((t) => <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">From *</span>
                  <input name="startDate" type="date" required defaultValue={fmtDate(now)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">To</span>
                  <input name="endDate" type="date" defaultValue={fmtDate(now)} className={inputCls} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Reason</span>
                <input name="reason" className={inputCls} placeholder="Optional" />
              </label>
              <button type="submit" className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark">
                Record
              </button>
            </div>
          </form>
        </FadeIn>
      </div>

      {/* All sessions */}
      <FadeIn delay={0.16}>
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <CalendarDays size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold">All sessions — {monthLabel}</h2>
          </div>
          {entries.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">No sessions logged this month.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Member</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">In</th>
                    <th className="px-5 py-3 font-medium">Out</th>
                    <th className="px-5 py-3 text-right font-medium">Hours</th>
                    <th className="px-5 py-3 text-right font-medium">Active</th>
                    <th className="px-5 py-3 font-medium">Tasks done</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((e) => (
                    <tr key={e.id} className="align-top hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{e.user.name}</td>
                      <td className="px-5 py-3 tabular-nums text-slate-600">{fmtDate(e.checkInAt)}</td>
                      <td className="px-5 py-3 tabular-nums text-slate-500">{fmtTime(e.checkInAt)}</td>
                      <td className="px-5 py-3 tabular-nums text-slate-500">{fmtTime(e.checkOutAt)}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">{e.hours != null ? e.hours.toFixed(2) : '—'}</td>
                      <td className="px-5 py-3 text-right">
                        {(() => {
                          const p = pct(e.activeSeconds, (e.hours ?? 0) * 3600);
                          return p != null ? <Pill className={pctTone(p)}>{p}%</Pill> : <span className="text-slate-300">—</span>;
                        })()}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500"><span className="whitespace-pre-line">{e.tasks || '—'}</span></td>
                      <td className="px-5 py-3"><RowActions deleteAction={deleteTimeEntry.bind(null, e.id)} label="session" /></td>
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
