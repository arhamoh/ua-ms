import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, Plus, BarChart3 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requestLeave, deleteLeave } from '@/app/actions';
import { LEAVE_TYPES, LEAVE_TYPE_LABELS, LEAVE_TYPE_BADGE, LEAVE_STATUS_LABELS, LEAVE_STATUS_BADGE } from '@/lib/enums';
import CheckInOut from '@/components/CheckInOut';
import RowActions from '@/components/RowActions';
import Pill from '@/components/Pill';
import FadeIn from '@/components/FadeIn';

export const dynamic = 'force-dynamic';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

const ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER'];
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const fmtTime = (d: Date | null) => (d ? new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—');

function leaveDays(start: Date, end: Date) {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

function activity(e: { hours: number | null; activeSeconds: number }) {
  const total = (e.hours ?? 0) * 3600;
  if (total <= 0) return null;
  return { pct: Math.min(100, Math.round((e.activeSeconds / total) * 100)), activeHours: e.activeSeconds / 3600 };
}
function pctTone(pct: number) {
  return pct >= 70 ? 'bg-emerald-100 text-emerald-700' : pct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
}

export default async function TimePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const isAdmin = session.roles.some((r) => ADMIN_ROLES.includes(r));

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const [open, entries, leaves] = await Promise.all([
    prisma.timeEntry.findFirst({ where: { userId: session.id, checkOutAt: null }, orderBy: { checkInAt: 'desc' } }),
    prisma.timeEntry.findMany({ where: { userId: session.id }, orderBy: { checkInAt: 'desc' }, take: 14 }),
    prisma.leaveRequest.findMany({ where: { userId: session.id }, orderBy: { startDate: 'desc' }, take: 12 }),
  ]);

  const weekHours = entries
    .filter((e) => e.checkOutAt && e.checkInAt >= weekStart)
    .reduce((s, e) => s + (e.hours ?? 0), 0);
  const today = now.toISOString().slice(0, 10);

  return (
    <div>
      <FadeIn>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Time &amp; attendance</h1>
            <p className="mt-1 text-sm text-slate-500">Check in / out, log your day, and request time off.</p>
          </div>
          {isAdmin && (
            <Link href="/time/report" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-brand">
              <BarChart3 size={15} /> Team report
            </Link>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.04}>
        <CheckInOut open={open ? { id: open.id, checkInAt: open.checkInAt.toISOString() } : null} />
      </FadeIn>

      <p className="mt-2 text-xs text-slate-400">
        Last 7 days: <span className="font-medium text-slate-600">{weekHours.toFixed(1)}h</span> logged. The dot in the
        header turns amber when idle; <span className="font-medium text-slate-600">Active %</span> is time with detected
        activity (idle time isn’t counted).
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sessions */}
        <FadeIn delay={0.08} className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold">Recent sessions</h2>
            </div>
            {entries.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">No sessions yet. Check in to start.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">In</th>
                      <th className="px-5 py-3 font-medium">Out</th>
                      <th className="px-5 py-3 text-right font-medium">Hours</th>
                      <th className="px-5 py-3 text-right font-medium">Active</th>
                      <th className="px-5 py-3 font-medium">Tasks done</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entries.map((e) => (
                      <tr key={e.id} className="align-top hover:bg-slate-50">
                        <td className="px-5 py-3 tabular-nums text-slate-600">{fmtDate(e.checkInAt)}</td>
                        <td className="px-5 py-3 tabular-nums text-slate-500">{fmtTime(e.checkInAt)}</td>
                        <td className="px-5 py-3 tabular-nums text-slate-500">
                          {e.checkOutAt ? fmtTime(e.checkOutAt) : <Pill className="bg-emerald-100 text-emerald-700">Open</Pill>}
                        </td>
                        <td className="px-5 py-3 text-right font-medium tabular-nums">{e.hours != null ? `${e.hours.toFixed(2)}` : '—'}</td>
                        <td className="px-5 py-3 text-right">
                          {(() => {
                            const a = activity(e);
                            return a ? (
                              <span className="inline-flex items-center gap-2">
                                <span className="tabular-nums text-slate-500">{a.activeHours.toFixed(1)}h</span>
                                <Pill className={pctTone(a.pct)}>{a.pct}%</Pill>
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {e.tasks ? <span className="whitespace-pre-line">{e.tasks}</span> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </FadeIn>

        {/* Leave */}
        <FadeIn delay={0.12}>
          <form action={requestLeave} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Plus size={16} className="text-brand" /> Request time off
            </h2>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Type</span>
                <select name="type" defaultValue="VACATION" className={inputCls}>
                  {LEAVE_TYPES.filter((t) => t !== 'ABSENT').map((t) => (
                    <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">From *</span>
                  <input name="startDate" type="date" required defaultValue={today} className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">To</span>
                  <input name="endDate" type="date" defaultValue={today} className={inputCls} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Reason</span>
                <input name="reason" className={inputCls} placeholder="Optional" />
              </label>
              <button type="submit" className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark">
                Submit request
              </button>
            </div>
          </form>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <CalendarDays size={15} className="text-slate-400" />
              <h2 className="text-sm font-semibold">My requests</h2>
            </div>
            {leaves.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500">No requests yet.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {leaves.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill className={LEAVE_TYPE_BADGE[l.type] ?? 'bg-slate-100 text-slate-600'}>{LEAVE_TYPE_LABELS[l.type] ?? l.type}</Pill>
                        <Pill className={LEAVE_STATUS_BADGE[l.status] ?? 'bg-slate-100 text-slate-600'}>{LEAVE_STATUS_LABELS[l.status] ?? l.status}</Pill>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {fmtDate(l.startDate)}{fmtDate(l.endDate) !== fmtDate(l.startDate) ? ` → ${fmtDate(l.endDate)}` : ''} · {leaveDays(l.startDate, l.endDate)}d
                        {l.reason ? ` · ${l.reason}` : ''}
                      </div>
                    </div>
                    {l.status === 'PENDING' && <RowActions deleteAction={deleteLeave.bind(null, l.id)} label="request" />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
