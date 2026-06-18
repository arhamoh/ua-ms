'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FolderKanban,
  UserPlus,
  Menu,
  X,
  LogOut,
  Coins,
  RefreshCw,
  PiggyBank,
  FileText,
  Sparkles,
  KeyRound,
  Settings,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import CommandPalette from '@/components/CommandPalette';
import NotificationBell from '@/components/NotificationBell';
import AssistantWidget from '@/components/AssistantWidget';
import HeaderClock from '@/components/HeaderClock';
import MigrationButton from '@/components/MigrationButton';
import { logout } from '@/app/login/actions';
import type { SessionUser } from '@/lib/auth';

const MotionLink = motion.create(Link);

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
type NavSection = { title?: string; items: NavItem[] };

const navSections: NavSection[] = [
  { items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    title: 'Delivery',
    items: [
      { href: '/clients', label: 'Clients', icon: Briefcase },
      { href: '/projects', label: 'Projects', icon: FolderKanban },
    ],
  },
  {
    title: 'Money',
    items: [
      { href: '/invoices', label: 'Invoices', icon: FileText },
      { href: '/finance', label: 'Finance', icon: PiggyBank },
      { href: '/commissions', label: 'Commissions', icon: Coins },
    ],
  },
  {
    title: 'Team',
    items: [
      { href: '/time', label: 'Time', icon: Clock },
      { href: '/team', label: 'Members', icon: Users },
    ],
  },
  {
    title: 'More',
    items: [
      { href: '/assistant', label: 'Assistant', icon: Sparkles },
      { href: '/logins', label: 'Logins', icon: KeyRound },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function NavContent({
  onNavigate,
  user,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  user: SessionUser;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      <div className={`flex h-16 items-center justify-center border-b border-slate-100 ${collapsed ? 'px-2' : 'px-4'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="UA Digital" className={collapsed ? 'h-8 w-auto' : 'h-14 w-auto'} />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navSections.map((section, si) => (
          <div key={section.title ?? 'main'} className={si > 0 ? 'pt-3' : ''}>
            {section.title &&
              (collapsed ? (
                <div className="mx-2 mb-1 border-t border-slate-100" />
              ) : (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {section.title}
                </p>
              ))}
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <MotionLink
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  title={collapsed ? label : undefined}
                  whileHover={{ x: collapsed ? 0 : 3 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className={`relative flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
                    collapsed ? 'justify-center px-2' : 'gap-3 px-3'
                  } ${
                    active ? 'bg-brand-light text-brand' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand"
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    />
                  )}
                  <Icon size={18} className={active ? 'text-brand' : 'text-slate-400'} />
                  {!collapsed && label}
                </MotionLink>
              );
            })}
          </div>
        ))}

        <div className="px-1 pt-4">
          <Link
            href="/onboard"
            onClick={onNavigate}
            title={collapsed ? 'Onboard Client' : undefined}
            className={`flex items-center justify-center gap-2 rounded-lg bg-brand py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark ${
              collapsed ? 'px-2' : 'px-3'
            }`}
          >
            <UserPlus size={16} />
            {!collapsed && 'Onboard Client'}
          </Link>
        </div>
      </nav>

      {/* Collapse toggle — desktop only (passed onToggleCollapse) */}
      {onToggleCollapse && (
        <div className="border-t border-slate-100 px-3 py-2">
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex w-full items-center rounded-lg py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 ${
              collapsed ? 'justify-center px-2' : 'gap-3 px-3'
            }`}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      )}

      <div className="border-t border-slate-100 p-3">
        <div className={`flex items-center py-2 ${collapsed ? 'flex-col gap-2 px-0' : 'gap-3 px-3'}`}>
          <span
            title={collapsed ? `${user.name} · ${user.email}` : undefined}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600"
          >
            {user.name?.[0]?.toUpperCase() ?? 'U'}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-[11px] text-slate-400">{user.email}</div>
            </div>
          )}
          <form action={logout}>
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
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
  attendance,
  children,
}: {
  user: SessionUser | null;
  attendance?: { open: boolean; checkInAt: string | null };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Restore the collapsed preference once on mount.
  useEffect(() => {
    setCollapsed(localStorage.getItem('ua_sidebar_collapsed') === '1');
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem('ua_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });

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
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex print:hidden ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <NavContent user={user} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
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
      <div className={`transition-[padding] duration-200 print:pl-0 ${collapsed ? 'lg:pl-16' : 'lg:pl-60'}`}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6 print:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
          >
            <Menu size={18} />
          </button>

          {/* Logo on mobile — tap to go back to the dashboard (sidebar is a drawer) */}
          <Link href="/" aria-label="Dashboard" className="lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="UA Digital" className="h-9 w-auto" />
          </Link>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <HeaderClock initial={attendance ?? { open: false, checkInAt: null }} />
            {user?.roles?.includes('SUPER_ADMIN') && <MigrationButton variant="header" />}
            <button
              onClick={hardRefresh}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand active:rotate-180"
              aria-label="Hard refresh"
              title="Hard refresh (clear cache & reload)"
            >
              <RefreshCw size={17} />
            </button>
            <NotificationBell />
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
