'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, Search, Check, LocateFixed } from 'lucide-react';

function allZones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['UTC', 'America/Toronto', 'America/New_York', 'America/Los_Angeles', 'Asia/Karachi', 'Europe/London'];
  }
}

function detectedZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

/**
 * A searchable timezone picker that submits its value via a hidden input named
 * `name`, so it drops into a plain <form action={...}> like a native <select>.
 */
export default function TimezoneSelect({
  name,
  defaultValue = '',
  required = false,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const all = useMemo(allZones, []);
  const detected = useMemo(detectedZone, []);
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? all.filter((z) => z.toLowerCase().includes(q) || z.replace(/_/g, ' ').toLowerCase().includes(q))
      : all;
    return list.slice(0, 80);
  }, [all, query]);

  const pick = (z: string) => {
    setValue(z);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative" ref={ref}>
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:border-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
      >
        <span className={value ? '' : 'text-slate-400'}>{value || 'Select timezone…'}</span>
        <ChevronDown size={15} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search size={14} className="text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search timezone or city…"
              className="w-full text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          {detected && detected !== value && (
            <button
              type="button"
              onClick={() => pick(detected)}
              className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs font-medium text-brand hover:bg-brand-light/40"
            >
              <LocateFixed size={14} /> Use my detected timezone — {detected}
            </button>
          )}

          <ul className="max-h-60 overflow-auto py-1">
            {matches.map((z) => (
              <li key={z}>
                <button
                  type="button"
                  onClick={() => pick(z)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {z}
                  {value === z && <Check size={14} className="text-brand" />}
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="px-3 py-3 text-sm text-slate-400">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
