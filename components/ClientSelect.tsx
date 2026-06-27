'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

/**
 * A searchable client picker. Submits the chosen client's name via a hidden
 * input named `name`, so it drops into a plain <form action={...}> like a native
 * <select>. Used for Agency Hours, where an "agency" is one of our clients.
 */
export default function ClientSelect({
  name,
  clients,
  defaultValue = '',
  required = false,
  placeholder = 'Select a client…',
}: {
  name: string;
  clients: { id: string; name: string }[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}) {
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
    const list = q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients;
    return list.slice(0, 80);
  }, [clients, query]);

  const pick = (n: string) => {
    setValue(n);
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
        <span className={value ? '' : 'text-slate-400'}>{value || placeholder}</span>
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
              placeholder="Search clients…"
              className="w-full text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <ul className="max-h-60 overflow-auto py-1">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => pick(c.name)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {c.name}
                  {value === c.name && <Check size={14} className="text-brand" />}
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-3 py-3 text-sm text-slate-400">{clients.length ? 'No matches' : 'No clients yet'}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
