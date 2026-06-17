'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  Briefcase,
  Users,
  UserPlus,
  FolderKanban,
  Coins,
  PiggyBank,
  FileText,
  Sparkles,
  Settings,
  Clock,
  CornerDownLeft,
  type LucideIcon,
} from 'lucide-react';

type Item = { id: string; label: string; sub?: string; href: string; group: string; icon: LucideIcon };

const PAGES: Item[] = [
  { id: 'p-dash', label: 'Dashboard', href: '/', group: 'Pages', icon: LayoutDashboard },
  { id: 'p-clients', label: 'Clients', href: '/clients', group: 'Pages', icon: Briefcase },
  { id: 'p-projects', label: 'Projects', href: '/projects', group: 'Pages', icon: FolderKanban },
  { id: 'p-commissions', label: 'Commissions', href: '/commissions', group: 'Pages', icon: Coins },
  { id: 'p-finance', label: 'Finance', href: '/finance', group: 'Pages', icon: PiggyBank },
  { id: 'p-invoices', label: 'Invoices', href: '/invoices', group: 'Pages', icon: FileText },
  { id: 'p-assistant', label: 'Analytics Assistant', href: '/assistant', group: 'Pages', icon: Sparkles },
  { id: 'p-time', label: 'Time & attendance', href: '/time', group: 'Pages', icon: Clock },
  { id: 'p-team', label: 'Team', href: '/team', group: 'Pages', icon: Users },
  { id: 'p-settings', label: 'Settings', href: '/settings', group: 'Pages', icon: Settings },
  { id: 'p-onboard', label: 'Onboard a client', href: '/onboard', group: 'Pages', icon: UserPlus },
];

type SearchData = {
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; sub: string }[];
  team: { id: string; name: string; sub: string }[];
};

const GROUPS = ['Pages', 'Projects', 'Clients', 'Team'];

export default function InlineSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [data, setData] = useState<SearchData | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Lazy-load the search index once.
  useEffect(() => {
    if (!data) {
      fetch('/api/search', { cache: 'no-store' })
        .then((r) => r.json())
        .then(setData)
        .catch(() => setData({ clients: [], projects: [], team: [] }));
    }
  }, [data]);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const items: Item[] = useMemo(() => {
    const dyn: Item[] = [];
    if (data) {
      data.projects.forEach((p) => dyn.push({ id: `pr-${p.id}`, label: p.name, sub: p.sub, href: `/projects/${p.id}`, group: 'Projects', icon: FolderKanban }));
      data.clients.forEach((c) => dyn.push({ id: `cl-${c.id}`, label: c.name, href: `/clients/${c.id}`, group: 'Clients', icon: Briefcase }));
      data.team.forEach((u) => dyn.push({ id: `tm-${u.id}`, label: u.name, sub: u.sub, href: '/team', group: 'Team', icon: Users }));
    }
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return [...PAGES, ...dyn]
      .filter((i) => i.label.toLowerCase().includes(q) || i.sub?.toLowerCase().includes(q))
      .slice(0, 12);
  }, [data, query]);

  useEffect(() => setActive(0), [query]);

  const go = (item?: Item) => {
    const t = item ?? items[active];
    if (!t) return;
    setOpen(false);
    setQuery('');
    router.push(t.href);
  };

  const showDropdown = open && query.trim().length > 0;
  let flat = -1;

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm focus-within:border-brand/40">
        <Search size={18} className="shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); go(); }
            else if (e.key === 'Escape') { setOpen(false); }
          }}
          placeholder="Search clients, projects, team — or jump to any page…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-400">No results for “{query}”</div>
          ) : (
            GROUPS.map((group) => {
              const groupItems = items.filter((i) => i.group === group);
              if (!groupItems.length) return null;
              return (
                <div key={group} className="mb-1">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group}</p>
                  {groupItems.map((item) => {
                    flat += 1;
                    const idx = flat;
                    const isActive = idx === active;
                    return (
                      <button
                        key={item.id}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(item)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${isActive ? 'bg-brand-light text-brand' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        <item.icon size={16} className={isActive ? 'text-brand' : 'text-slate-400'} />
                        <span className="flex-1 truncate">
                          {item.label}
                          {item.sub && <span className="ml-2 text-xs text-slate-400">{item.sub}</span>}
                        </span>
                        {isActive && <CornerDownLeft size={14} className="text-brand" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
