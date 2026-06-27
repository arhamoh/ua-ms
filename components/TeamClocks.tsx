'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, ChevronDown, Building2, Check } from 'lucide-react';
import { formatTimeInTz } from '@/lib/schedule';

/** The two home offices, always shown. Montreal uses America/Toronto (Eastern). */
const CORE_ZONES = [
  { tz: 'America/Toronto', label: 'Montreal' },
  { tz: 'Asia/Karachi', label: 'Karachi' },
];

/**
 * Live header clocks.
 *
 * Always shows both home offices — Montreal + Karachi. Privileged roles (super
 * admin / manager / PM) also get an agency clock: a dropdown to pick which
 * partner agency's local time to show. The choice is remembered per device.
 *
 * Desktop shows an inline row (clocks separated by "|") with the agency picker at
 * the end; mobile collapses everything into one tap-to-open dropdown where the
 * agencies are a selectable list. Rendered only after mount so server/client
 * agree on the time.
 */
export default function TeamClocks({
  agencyZones = [],
}: {
  agencyZones?: { tz: string; label: string }[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [open, setOpen] = useState(false); // mobile dropdown
  const [agencyOpen, setAgencyOpen] = useState(false); // desktop agency picker
  const [selectedTz, setSelectedTz] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const agencyKey = useMemo(() => agencyZones.map((a) => a.tz).join('|'), [agencyZones]);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Pick the active agency once we know the list — restore the saved choice if
  // it's still a configured agency, otherwise default to the first.
  useEffect(() => {
    if (!agencyZones.length) {
      setSelectedTz(null);
      return;
    }
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('ua_clock_agency');
    } catch {
      // ignore
    }
    const valid = agencyZones.find((a) => a.tz === saved);
    setSelectedTz(valid ? valid.tz : agencyZones[0].tz);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyKey]);

  // Close any open menu when tapping outside the component.
  useEffect(() => {
    if (!open && !agencyOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAgencyOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, agencyOpen]);

  if (!now) return null;

  const selectAgency = (tz: string) => {
    setSelectedTz(tz);
    try {
      localStorage.setItem('ua_clock_agency', tz);
    } catch {
      // ignore
    }
  };
  const selectedAgency = agencyZones.find((a) => a.tz === selectedTz) ?? null;

  return (
    <div ref={wrapRef} className="flex items-center">
      {/* Desktop: inline row */}
      <div className="hidden items-center gap-2 md:flex">
        {CORE_ZONES.map((z, i) => (
          <div key={z.tz} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-300">|</span>}
            <span className="flex items-center gap-1.5" title={`${z.tz} — current local time`}>
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{z.label}</span>
              <span className="text-xs font-semibold tabular-nums text-slate-700">{formatTimeInTz(z.tz, now)}</span>
            </span>
          </div>
        ))}

        {selectedAgency && (
          <div className="flex items-center gap-2">
            <span className="text-slate-300">|</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAgencyOpen((o) => !o)}
                aria-label="Choose agency clock"
                aria-expanded={agencyOpen}
                title={`${selectedAgency.tz} — current local time`}
                className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-slate-100"
              >
                <Building2 size={13} className="text-slate-400" />
                <span className="max-w-[120px] truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {selectedAgency.label}
                </span>
                <span className="text-xs font-semibold tabular-nums text-slate-700">{formatTimeInTz(selectedAgency.tz, now)}</span>
                <ChevronDown size={12} className={`text-slate-400 transition-transform ${agencyOpen ? 'rotate-180' : ''}`} />
              </button>

              {agencyOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {agencyZones.map((a) => {
                    const active = a.tz === selectedTz;
                    return (
                      <button
                        key={`${a.tz}-${a.label}`}
                        type="button"
                        onClick={() => {
                          selectAgency(a.tz);
                          setAgencyOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50 ${active ? 'bg-brand-light' : ''}`}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          {active ? <Check size={13} className="shrink-0 text-brand" /> : <span className="w-[13px] shrink-0" />}
                          <span className={`truncate text-xs font-medium ${active ? 'text-brand' : 'text-slate-600'}`}>{a.label}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">{formatTimeInTz(a.tz, now)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile: one dropdown with core clocks + a selectable agency list */}
      <div className="relative md:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="World clocks"
          aria-expanded={open}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600 active:bg-slate-100"
        >
          <Clock size={15} className="text-slate-400" />
          <span className="text-xs font-semibold tabular-nums text-slate-700">{formatTimeInTz(CORE_ZONES[0].tz, now)}</span>
          <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {CORE_ZONES.map((z) => (
              <div key={z.tz} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
                <span className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">{z.label}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">{formatTimeInTz(z.tz, now)}</span>
              </div>
            ))}

            {agencyZones.length > 0 && (
              <>
                <div className="bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Agency</div>
                {agencyZones.map((a) => {
                  const active = a.tz === selectedTz;
                  return (
                    <button
                      key={`${a.tz}-${a.label}`}
                      type="button"
                      onClick={() => selectAgency(a.tz)}
                      className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 ${active ? 'bg-brand-light' : ''}`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        {active ? <Check size={12} className="shrink-0 text-brand" /> : <span className="w-3 shrink-0" />}
                        <span className={`truncate text-[11px] font-medium uppercase tracking-wide ${active ? 'text-brand' : 'text-slate-400'}`}>
                          {a.label}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">{formatTimeInTz(a.tz, now)}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
