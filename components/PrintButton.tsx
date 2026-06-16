'use client';

import { Printer } from 'lucide-react';

export default function PrintButton({ label = 'Print / Download' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 print:hidden"
    >
      <Printer size={15} /> {label}
    </button>
  );
}
