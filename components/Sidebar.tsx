'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  UserPlus,
  Settings,
  type LucideIcon,
} from 'lucide-react';

type NavItem = { href: string; label: string; icon: LucideIcon };

const nav: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Briefcase },
  { href: '/team', label: 'Team', icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-slate-200 bg-white">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white">
          UA
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Agency Platform</div>
          <div className="text-[11px] text-slate-400">Project management</div>
        </div>
      </div>

      {/* Nav */}
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
            className="flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
          >
            <UserPlus size={16} />
            Onboard Client
          </Link>
        </div>
      </nav>

      {/* Footer / user */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
            UA
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium">UA Agency</div>
            <div className="truncate text-[11px] text-slate-400">Signed out</div>
          </div>
          <Settings size={16} className="text-slate-400" />
        </div>
      </div>
    </aside>
  );
}
