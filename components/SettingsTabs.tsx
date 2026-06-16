'use client';

import { useState, type ReactNode } from 'react';

export type SettingsTab = { id: string; label: string; icon?: ReactNode; content: ReactNode };

// Tabbed container for the Settings page. Each tab's content is server-rendered
// and passed in as a ReactNode, so server-action forms keep working.
export default function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1.5 text-sm font-medium transition ${
                on ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="mt-6">{current?.content}</div>
    </div>
  );
}
