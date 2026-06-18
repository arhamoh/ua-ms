'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  Search,
  LayoutDashboard,
  Briefcase,
  Users,
  UserPlus,
  FolderKanban,
  CornerDownLeft,
  Coins,
  PiggyBank,
  FileText,
  Sparkles,
  KeyRound,
  Settings,
  Clock,
  type LucideIcon,
} from 'lucide-react';

type Item = {
  id: string;
  label: string;
  sub?: string;
  href: string;
  group: string;
  icon: LucideIcon;
};

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
  { id: 'p-logins', label: 'Logins', href: '/logins', group: 'Pages', icon: KeyRound },
  { id: 'p-settings', label: 'Settings', href: '/settings', group: 'Pages', icon: Settings },
  { id: 'p-onboard', label: 'Onboard a client', href: '/onboard', group: 'Pages', icon: UserPlus },
];

type SearchData = {
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; sub: string }[];
  team: { id: string; name: string; sub: string }[];
  logins: { id: string; name: string; sub?: string }[];
};

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [data, setData] = useState<SearchData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  // Global ⌘K / Ctrl+K and an event hook for the top-bar button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-command-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-command-palette', onOpen);
    };
  }, []);

  // Lazy-load the search index when first opened.
  useEffect(() => {
    if (open && !data) {
      fetch('/api/search', { cache: 'no-store' })
        .then((r) => r.json())
        .then(setData)
        .catch(() => setData({ clients: [], projects: [], team: [], logins: [] }));
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open, data]);

  const items: Item[] = useMemo(() => {
    const dynamic: Item[] = [];
    if (data) {
      data.projects.forEach((p) =>
        dynamic.push({ id: `pr-${p.id}`, label: p.name, sub: p.sub, href: `/projects/${p.id}`, group: 'Projects', icon: FolderKanban }),
      );
      data.clients.forEach((c) =>
        dynamic.push({ id: `cl-${c.id}`, label: c.name, href: `/clients/${c.id}`, group: 'Clients', icon: Briefcase }),
      );
      data.team.forEach((u) =>
        dynamic.push({ id: `tm-${u.id}`, label: u.name, sub: u.sub, href: '/team', group: 'Team', icon: Users }),
      );
      data.logins?.forEach((l) =>
        dynamic.push({ id: `lg-${l.id}`, label: l.name, sub: l.sub, href: `/logins?focus=${l.id}`, group: 'Logins', icon: KeyRound }),
      );
    }
    const all = [...PAGES, ...dynamic];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (i) => i.label.toLowerCase().includes(q) || i.sub?.toLowerCase().includes(q),
    );
  }, [data, query]);

  // Keep active index in range as results change.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, items.length - 1)));
  }, [items.length]);

  const select = useCallback(
    (item?: Item) => {
      const target = item ?? items[active];
      if (!target) return;
      close();
      router.push(target.href);
    },
    [items, active, router, close],
  );

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  // Group items in render order while keeping a flat index for keyboard nav.
  let flatIndex = -1;
  const groups = ['Pages', 'Projects', 'Clients', 'Team', 'Logins'];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={close} />
          <motion.div
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4">
              <Search size={18} className="text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKey}
                placeholder="Search projects, clients, team…"
                className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-slate-400"
              />
              <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
              {items.length === 0 ? (
                <div className="px-3 py-10 text-center text-sm text-slate-400">
                  No results for “{query}”
                </div>
              ) : (
                groups.map((group) => {
                  const groupItems = items.filter((i) => i.group === group);
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={group} className="mb-1">
                      <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {group}
                      </p>
                      {groupItems.map((item) => {
                        flatIndex += 1;
                        const idx = flatIndex;
                        const isActive = idx === active;
                        return (
                          <button
                            key={item.id}
                            onMouseEnter={() => setActive(idx)}
                            onClick={() => select(item)}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                              isActive ? 'bg-brand-light text-brand' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <item.icon size={16} className={isActive ? 'text-brand' : 'text-slate-400'} />
                            <span className="flex-1 truncate">
                              {item.label}
                              {item.sub && (
                                <span className="ml-2 text-xs text-slate-400">{item.sub}</span>
                              )}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
