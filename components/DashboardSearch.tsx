'use client';

import { Search } from 'lucide-react';

export default function DashboardSearch() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left text-sm text-slate-400 shadow-sm transition hover:border-brand/40 hover:shadow"
    >
      <Search size={18} className="text-slate-400" />
      <span className="flex-1">Search clients, projects, team — or jump to any page…</span>
      <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-400 sm:block">
        ⌘K
      </kbd>
    </button>
  );
}
