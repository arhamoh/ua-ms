'use client';

import { useState, useTransition } from 'react';
import { saveNotifyPrefs } from '@/app/actions';
import { NOTIFY_CATEGORIES, type NotifyCategory } from '@/lib/notify-categories';

export default function NotificationPrefs({ initial }: { initial: Record<NotifyCategory, boolean> }) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, start] = useTransition();

  const toggle = (id: NotifyCategory) => {
    const next = { ...prefs, [id]: !prefs[id] };
    setPrefs(next);
    start(() => saveNotifyPrefs(next).catch(() => {}));
  };

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-semibold text-slate-700">Which notifications</h3>
      <p className="mb-3 mt-0.5 text-xs text-slate-500">Choose what sends you a push. In-app notifications always show in the bell.</p>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
        {NOTIFY_CATEGORIES.map((c) => {
          const on = prefs[c.id];
          return (
            <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800">{c.label}</div>
                <div className="text-xs text-slate-400">{c.desc}</div>
              </div>
              <button
                type="button"
                onClick={() => toggle(c.id)}
                disabled={pending}
                role="switch"
                aria-checked={on}
                className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${on ? 'bg-brand' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
