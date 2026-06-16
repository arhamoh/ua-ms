'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  UserPlus,
  Search,
  Bell,
  Menu,
  X,
  LogOut,
  Coins,
  RefreshCw,
  PiggyBank,
  FileText,
  Sparkles,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import CommandPalette from '@/components/CommandPalette';
import AssistantWidget from '@/components/AssistantWidget';
import { logout } from '@/app/login/actions';
import type { SessionUser } from '@/lib/auth';

function openSearch() {
  window.dispatchEvent(new Event('open-command-palette'));
}

// Hard refresh: clear caches + update the service worker, then reload from network.
async function hardRefresh() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update()));
    }
  } catch {
    // ignore — still reload below
  }
  window.location.reload();
}

type NavItem = { href: string; label: string; icon: LucideIcon };

const nav: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Briefcase },
  { href: '/commissions', label: 'Commissions', icon: Coins },
  { href: '/finance', label: 'Finance', icon: PiggyBank },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/assistant', label: 'Assistant', icon: Sparkles },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function NavContent({ onNavigate, user }: { onNavigate?: () => void; user: SessionUser }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white">
          UA
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Agency Platform</div>
          <div className="text-[11px] text-slate-400">Project management</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Menu
        </p>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-brand-light text-brand'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon size={18} className={active ? 'text-brand' : 'text-slate-400'} />
              {label}
            </Link>
          );
        })}

        <div className="px-3 pt-4">
          <Link
            href="/onboard"
            onClick={onNavigate}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
          >
            <UserPlus size={16} />
            Onboard Client
          </Link>
        </div>
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
            {user.name?.[0]?.toUpperCase() ?? 'U'}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-[11px] text-slate-400">{user.email}</div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              aria-label="Sign out"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default function AppShell({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Unauthenticated routes (login, forgot-password) render bare, no chrome.
  if (!user) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex print:hidden">
        <NavContent user={user} />
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 lg:hidden print:hidden ${open ? '' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-slate-900/40 transition-opacity ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl transition-transform duration-200 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
          <NavContent onNavigate={() => setOpen(false)} user={user} />
        </aside>
      </div>

      {/* Main column */}
      <div className="lg:pl-60 print:pl-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6 print:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
          >
            <Menu size={18} />
          </button>

          <button
            onClick={openSearch}
            className="hidden w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 transition hover:bg-white sm:flex"
          >
            <Search size={16} />
            <span>Search…</span>
            <kbd className="ml-auto rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              onClick={openSearch}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 sm:hidden"
              aria-label="Search"
            >
              <Search size={18} />
            </button>
            <button
              onClick={hardRefresh}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand active:rotate-180"
              aria-label="Hard refresh"
              title="Hard refresh (clear cache & reload)"
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="hidden h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 sm:grid"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-xs font-semibold text-white">
              UA
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>

      <CommandPalette />
      <AssistantWidget />
    </>
  );
}
