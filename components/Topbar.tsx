import { Search, Bell } from 'lucide-react';

export default function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 px-6 backdrop-blur">
      <div className="relative w-full max-w-sm">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          placeholder="Search clients, projects…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-xs font-semibold text-white">
          UA
        </span>
      </div>
    </header>
  );
}
