'use client';

import { useEffect, useState } from 'react';
import { formatTimeInTz, formatDayInTz, isOpenNow, tzLabel, minToLabel, DAY_LABELS } from '@/lib/schedule';

export type Agency = {
  id: string;
  name: string;
  timezone: string;
  days: number[];
  startMin: number;
  endMin: number;
  note: string | null;
};

/** Live local-time cards for each partner agency, with an open/closed badge. */
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
        const open = now ? isOpenNow(a.days, a.startMin, a.endMin, a.timezone, now) : false;
        const dayList = [...a.days].sort((x, y) => x - y).map((d) => DAY_LABELS[d]).join(' ');
        return (
          <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-800">{a.name}</div>
                <div className="text-xs text-slate-400">{tzLabel(a.timezone)} · {now ? formatDayInTz(a.timezone, now) : ''}</div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  open ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {open ? '● Open now' : 'Closed'}
              </span>
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
