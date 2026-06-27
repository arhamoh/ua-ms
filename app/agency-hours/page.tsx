import { redirect } from 'next/navigation';
import { Globe, Plus, Trash2, Clock } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageAgencyHours } from '@/lib/enums';
import { DAY_LABELS, minToHHMM } from '@/lib/schedule';
import FadeIn from '@/components/FadeIn';
import AgencyClocks from '@/components/AgencyClocks';
import TimezoneSelect from '@/components/TimezoneSelect';
import ClientSelect from '@/components/ClientSelect';
import { createAgency, updateAgency, deleteAgency } from './actions';

export const dynamic = 'force-dynamic';

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

type Agency = {
  id: string;
  name: string;
  timezone: string;
  days: number[];
  startMin: number;
  endMin: number;
  note: string | null;
};

function ScheduleFields({ agency, clients }: { agency?: Agency; clients: { id: string; name: string }[] }) {
  const days = agency?.days ?? [1, 2, 3, 4, 5];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">Client</span>
        <ClientSelect name="name" clients={clients} defaultValue={agency?.name ?? ''} required placeholder="Search & select a client…" />
      </div>
      <div className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">Timezone</span>
        <TimezoneSelect name="timezone" defaultValue={agency?.timezone ?? ''} required />
      </div>
      <div className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">Working days</span>
        <div className="flex flex-wrap gap-1.5">
          {DAY_LABELS.map((d, i) => (
            <label key={d} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 has-[:checked]:border-brand has-[:checked]:bg-brand-light has-[:checked]:text-brand">
              <input type="checkbox" name="days" value={i} defaultChecked={days.includes(i)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand" />
              {d}
            </label>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Start (their time)</span>
        <input type="time" name="start" defaultValue={agency ? minToHHMM(agency.startMin) : '09:00'} className={inputCls} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">End (their time)</span>
        <input type="time" name="end" defaultValue={agency ? minToHHMM(agency.endMin) : '17:00'} className={inputCls} />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">Note (optional)</span>
        <input name="note" defaultValue={agency?.note ?? ''} placeholder="e.g. async-friendly, prefers mornings" className={inputCls} />
      </label>
    </div>
  );
}

export default async function AgencyHoursPage() {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!canManageAgencyHours(user.roles)) redirect('/');

  const [agencies, clients] = await Promise.all([
    prisma.agencySchedule.findMany({ orderBy: { name: 'asc' } }),
    prisma.client.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="max-w-4xl">
      <FadeIn>
        <div className="flex items-center gap-2">
          <Globe size={22} className="text-brand" />
          <h1 className="text-2xl font-bold tracking-tight">Agency hours</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">The working hours we&apos;ve agreed with partner agencies, with their live local time.</p>
      </FadeIn>

      {agencies.length > 0 && (
        <FadeIn className="mt-6 block">
          <AgencyClocks agencies={agencies} />
        </FadeIn>
      )}

      {/* Add */}
      <FadeIn className="mt-6 block">
        <form action={createAgency} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Plus size={18} className="text-brand" />
            <h2 className="text-sm font-semibold">Add an agency schedule</h2>
          </div>
          <ScheduleFields clients={clients} />
          <button className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">
            <Plus size={15} /> Add agency
          </button>
        </form>
      </FadeIn>

      {/* Manage existing */}
      {agencies.length > 0 && (
        <div className="mt-6 space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Clock size={16} className="text-slate-400" /> Manage schedules
          </h2>
          {agencies.map((a) => (
            <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <form action={updateAgency}>
                <input type="hidden" name="id" value={a.id} />
                <ScheduleFields agency={a} clients={clients} />
                <div className="mt-4 flex items-center gap-2">
                  <button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">Save changes</button>
                </div>
              </form>
              <form action={deleteAgency} className="mt-2">
                <input type="hidden" name="id" value={a.id} />
                <button className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:underline">
                  <Trash2 size={13} /> Delete {a.name}
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
