'use client';

import { useEffect, useState } from 'react';
import { formatTimeInTz, tzOffsetMinutes } from '@/lib/schedule';

/** The two home offices. Montreal uses America/Toronto (Eastern) under the hood. */
const CORE_ZONES = [
  { tz: 'America/Toronto', label: 'Montreal' },
  { tz: 'Asia/Karachi', label: 'Karachi' },
];

/**
 * Live header clocks.
 *
 * Core rule: always show Montreal + Karachi, except the one matching where the
 * viewer currently is — so from Montreal you see only Karachi, from Karachi only
 * Montreal, and from anywhere else you see both. "Where you are" is the browser's
 * detected timezone, matched by current UTC offset.
 *
 * Privileged roles (super admin / manager / PM) also get the partner-agency
 * clocks appended. Each clock is separated by a "|".
 *
 * Rendered only after mount so server/client agree (the browser timezone — and
 * therefore which clocks show — is only known on the client).
 */
export default function TeamClocks({
  agencyZones = [],
}: {
  agencyZones?: { tz: string; label: string }[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [browserTz, setBrowserTz] = useState<string | null>(null);
  useEffect(() => {
    setNow(new Date());
    try {
      setBrowserTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      // ignore — without a browser tz we just show both core zones
    }
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return null;

  const myOffset = browserTz ? tzOffsetMinutes(browserTz, now) : NaN;
  const core = CORE_ZONES.filter((z) => tzOffsetMinutes(z.tz, now) !== myOffset);
  const clocks = [...core, ...agencyZones];
  if (!clocks.length) return null;

  return (
    <div className="hidden items-center gap-2 md:flex">
      {clocks.map((z, i) => (
        <div key={`${z.tz}-${z.label}`} className="flex items-center gap-2">
          {i > 0 && <span className="text-slate-300">|</span>}
          <span className="flex items-center gap-1.5" title={`${z.tz} — current local time`}>
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{z.label}</span>
            <span className="text-xs font-semibold tabular-nums text-slate-700">{formatTimeInTz(z.tz, now)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
