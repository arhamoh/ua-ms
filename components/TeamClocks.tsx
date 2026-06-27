'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import { formatTimeInTz } from '@/lib/schedule';

/** The two home offices, always shown. Montreal uses America/Toronto (Eastern). */
const CORE_ZONES = [
  { tz: 'America/Toronto', label: 'Montreal' },
  { tz: 'Asia/Karachi', label: 'Karachi' },
];

/**
 * Live header clocks.
 *
 * Always shows both home offices — Montreal + Karachi — no matter where the
 * viewer is. Privileged roles (super admin / manager / PM) also get the
 * partner-agency clocks appended when any are configured. Each clock is
 * separated by a "|".
 *
 * Desktop shows an inline row; mobile collapses it into a tap-to-open dropdown so
 * the header stays uncluttered. Rendered only after mount so server/client agree
 * on the time.
 */
export default function TeamClocks({
  agencyZones = [],
}: {
  agencyZones?: { tz: string; label: string }[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Close the mobile dropdown when tapping outside it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!now) return null;

  const clocks = [...CORE_ZONES, ...agencyZones];

  return (
    <>
      {/* Desktop: inline row, clocks separated by a | */}
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

      {/* Mobile: tap-to-open dropdown with all the clocks */}
      <div ref={wrapRef} className="relative md:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="World clocks"
          aria-expanded={open}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600 active:bg-slate-100"
        >
          <Clock size={15} className="text-slate-400" />
          <span className="text-xs font-semibold tabular-nums text-slate-700">{formatTimeInTz(clocks[0].tz, now)}</span>
          <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {clocks.map((z) => (
              <div
                key={`${z.tz}-${z.label}`}
                className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0"
              >
                <span className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">{z.label}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">{formatTimeInTz(z.tz, now)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
