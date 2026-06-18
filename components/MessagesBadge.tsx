'use client';

import { useEffect, useState } from 'react';

// Total unread-message count for the sidebar "Messages" tab. Polls lightly and
// refreshes on window focus. Caps the display at "20+".
export default function MessagesBadge({ collapsed = false }: { collapsed?: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/messages', { cache: 'no-store' });
        const d = await r.json();
        if (alive) setCount(d.totalUnread ?? 0);
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 15_000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (count <= 0) return null;
  const label = count > 20 ? '20+' : String(count);

  if (collapsed) {
    return (
      <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-semibold text-white">
        {label}
      </span>
    );
  }
  return (
    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">
      {label}
    </span>
  );
}
