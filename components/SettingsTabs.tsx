'use client';

import { useEffect, useState, type ReactNode } from 'react';

export type SettingsTab = { id: string; label: string; icon?: ReactNode; content: ReactNode };

// Tabbed container for the Settings page. Each tab's content is server-rendered
// and passed in as a ReactNode, so server-action forms keep working. The active
// tab is mirrored to the URL hash so a refresh (or shared link) reopens it.
export default function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  useEffect(() => {
    const h = window.location.hash.replace('#', '');
    if (h && tabs.some((t) => t.id === h)) setActive(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (id: string) => {
    setActive(id);
    try { history.replaceState(null, '', `#${id}`); } catch { /* ignore */ }
  };

  return (
    <div className="mt-5">
      {/* Mobile: a single dropdown instead of a wrapping row of tabs. */}
      <div className="sm:hidden">
        <label className="mb-1.5 block text-xs font-medium text-slate-500">Section</label>
        <select
          value={active}
          onChange={(e) => select(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
        >
          {tabs.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Desktop: one horizontal row that scrolls if needed — never wraps. */}
      <div className="hidden border-b border-slate-200 sm:block">
        <div className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                onClick={() => select(t.id)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1.5 text-sm font-medium transition ${
                  on ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">{current?.content}</div>
    </div>
  );
}
