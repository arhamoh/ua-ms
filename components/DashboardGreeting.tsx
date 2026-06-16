'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

// Greeting is derived from the browser's LOCAL time, so it's correct whether the
// user logs in from Canada, Pakistan, or anywhere else.
export default function DashboardGreeting({ name }: { name: string }) {
  const [greeting, setGreeting] = useState('Hello');
  const first = name.split(' ')[0] || name;

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening');
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border border-l-4 border-slate-200 border-l-brand bg-gradient-to-r from-brand-light/70 to-white p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting},{' '}
          <span className="italic text-brand">{first}!</span>
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">Here’s what’s happening across your agency.</p>
      </div>
      <Link
        href="/onboard"
        className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
      >
        Onboard Client
      </Link>
    </div>
  );
}
