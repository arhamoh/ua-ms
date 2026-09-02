'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X, Check } from 'lucide-react';
import { updateOption, deleteOptionById } from '@/app/actions';

// An editable option chip: rename (keeps the stored value) or delete.
export default function OptionChip({ id, label, rate }: { id: string; label: string; rate?: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);

  const save = () => {
    const v = value.trim();
    if (!v || v === label) { setEditing(false); return; }
    start(async () => { await updateOption(id, v); setEditing(false); router.refresh(); });
  };
  const del = () => start(async () => { await deleteOptionById(id); router.refresh(); });

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-white py-0.5 pl-2 pr-1 text-xs">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setValue(label); } }}
          className="w-28 border-0 bg-transparent p-0 text-xs focus:outline-none"
        />
        <button onClick={save} disabled={pending} title="Save" className="grid h-4 w-4 place-items-center rounded-full text-emerald-600 hover:bg-emerald-50"><Check size={11} /></button>
        <button onClick={() => { setEditing(false); setValue(label); }} title="Cancel" className="grid h-4 w-4 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X size={11} /></button>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-xs text-slate-700 ${pending ? 'opacity-50' : ''}`}>
      {label}
      {rate != null && <span className="text-slate-400">· {rate}%</span>}
      <button onClick={() => { setValue(label); setEditing(true); }} title="Rename" className="grid h-4 w-4 place-items-center rounded-full text-slate-300 transition hover:bg-slate-200 hover:text-slate-600"><Pencil size={10} /></button>
      <button onClick={del} disabled={pending} title="Delete" className="grid h-4 w-4 place-items-center rounded-full text-slate-300 transition hover:bg-rose-100 hover:text-rose-600"><X size={11} /></button>
    </span>
  );
}
