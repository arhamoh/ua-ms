'use client';

import { useEffect, useState } from 'react';
import { formatTimeInTz } from '@/lib/schedule';

/**
 * Live clocks in the header for the distinct timezones the team spans — except
 * the viewer's own. Lets people in different timezones see each other's time.
 * Rendered only after mount so server/client don't disagree on the time.
 */
export default function TeamClocks({ zones }: { zones: { tz: string; label: string }[] }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!zones.length) return null;

  return (
    <div className="hidden items-center gap-1.5 md:flex">
      {zones.map((z) => (
        <div
          key={z.tz}
          title={`${z.tz} — current local time`}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5"
        >
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{z.label}</span>
          <span className="text-xs font-semibold tabular-nums text-slate-700">
            {now ? formatTimeInTz(z.tz, now) : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
