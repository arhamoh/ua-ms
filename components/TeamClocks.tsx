'use client';

import { useEffect, useState } from 'react';
import { formatTimeInTz, tzLabel } from '@/lib/schedule';

/**
 * Live clocks in the header: the viewer's own local time (labeled "You") shown
 * side by side with every other distinct timezone the team spans. Lets people in
 * different timezones see each other's time at a glance — e.g. Montreal sees
 * Karachi and Karachi sees Montreal.
 *
 * The viewer's own zone comes from their saved Settings timezone (`myTz`); if
 * they haven't set one yet we fall back to the browser's detected timezone so a
 * clock always appears. Rendered only after mount so server/client don't
 * disagree on the time.
 */
export default function TeamClocks({
  myTz,
  zones,
}: {
  myTz: string | null;
  zones: { tz: string; label: string }[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [browserTz, setBrowserTz] = useState<string | null>(null);
  useEffect(() => {
    setNow(new Date());
    try {
      setBrowserTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      // ignore — own clock simply won't render without a known tz
    }
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const ownTz = myTz ?? browserTz;

  // Viewer's own clock first, then each other zone (skipping any that matches
  // the viewer's own so we never show the same time twice).
  const clocks: { tz: string; label: string; you: boolean }[] = [];
  if (ownTz) clocks.push({ tz: ownTz, label: 'You', you: true });
  for (const z of zones) {
    if (z.tz !== ownTz) clocks.push({ tz: z.tz, label: z.label || tzLabel(z.tz), you: false });
  }

  if (!clocks.length) return null;

  return (
    <div className="hidden items-center gap-1.5 md:flex">
      {clocks.map((z) => (
        <div
          key={z.tz}
          title={`${z.tz} — current local time`}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
            z.you ? 'border-brand/30 bg-brand-light' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <span
            className={`text-[11px] font-medium uppercase tracking-wide ${
              z.you ? 'text-brand' : 'text-slate-400'
            }`}
          >
            {z.label}
          </span>
          <span
            className={`text-xs font-semibold tabular-nums ${z.you ? 'text-brand-dark' : 'text-slate-700'}`}
          >
            {now ? formatTimeInTz(z.tz, now) : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
