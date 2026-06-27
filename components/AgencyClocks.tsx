'use client';

import { useEffect, useState } from 'react';
import {
  formatTimeInTz,
  formatDayInTz,
  agencyStatus,
  formatDuration,
  tzLabel,
  minToLabel,
  DAY_LABELS,
  CLOSING_SOON_MIN,
} from '@/lib/schedule';

export type Agency = {
  id: string;
  name: string;
  timezone: string;
  days: number[];
  startMin: number;
  endMin: number;
  note: string | null;
};

/**
 * Live local-time cards for each partner agency. Cards are tinted by status:
 * green when within working hours, red when about to close (≤ CLOSING_SOON_MIN
 * left), neutral when closed — with a countdown to close.
 */
export default function AgencyClocks({ agencies }: { agencies: Agency[] }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!agencies.length) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agencies.map((a) => {
        const status = now ? agencyStatus(a.days, a.startMin, a.endMin, a.timezone, now) : { open: false, minutesLeft: 0 };
        const closingSoon = status.open && status.minutesLeft <= CLOSING_SOON_MIN;
        const dayList = [...a.days].sort((x, y) => x - y).map((d) => DAY_LABELS[d]).join(' ');

        // Card tint + badge by status.
        const cardCls = closingSoon
          ? 'border-rose-200 bg-rose-50/60'
          : status.open
            ? 'border-emerald-200 bg-emerald-50/50'
            : 'border-slate-200 bg-white';
        const badgeCls = closingSoon
          ? 'bg-rose-100 text-rose-700'
          : status.open
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-100 text-slate-500';
        const badgeText = closingSoon
          ? `Closing in ${formatDuration(status.minutesLeft)}`
          : status.open
            ? `● Open · ${formatDuration(status.minutesLeft)} left`
            : 'Closed';

        return (
          <div key={a.id} className={`rounded-2xl border p-5 shadow-sm transition-colors ${cardCls}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-800">{a.name}</div>
                <div className="text-xs text-slate-400">{tzLabel(a.timezone)} · {now ? formatDayInTz(a.timezone, now) : ''}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeCls}`}>{badgeText}</span>
            </div>
            <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
              {now ? formatTimeInTz(a.timezone, now, true) : '—'}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {dayList || 'No days set'} · {minToLabel(a.startMin)}–{minToLabel(a.endMin)}
            </div>
            {a.note && <div className="mt-1.5 text-xs text-slate-400">{a.note}</div>}
          </div>
        );
      })}
    </div>
  );
}
