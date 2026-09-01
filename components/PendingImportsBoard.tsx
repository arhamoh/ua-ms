'use client';

import { Fragment, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Landmark, CreditCard, ChevronRight, GripVertical } from 'lucide-react';
import { setPendingImportType } from '@/app/actions';
import PendingTypeToggle from './PendingTypeToggle';

type P = { id: string; fileName: string; accountType: string; accountLabel: string; count: number; year: number; month: number; period: string };

const SECTIONS = [
  { type: 'BANK', label: 'Bank account statements', Icon: Landmark },
  { type: 'CREDIT_CARD', label: 'Credit card statements', Icon: CreditCard },
] as const;

export default function PendingImportsBoard({ pending }: { pending: P[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [overType, setOverType] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const move = (id: string, type: string) => {
    const item = pending.find((p) => p.id === id);
    if (!item || item.accountType === type) return;
    start(async () => {
      await setPendingImportType(id, type);
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {SECTIONS.map((section) => {
        const rows = pending
          .filter((p) => p.accountType === section.type)
          .sort((a, b) => (b.year || -1) - (a.year || -1) || (a.month || 13) - (b.month || 13) || a.accountLabel.localeCompare(b.accountLabel));
        const isOver = overType === section.type;
        return (
          <div
            key={section.type}
            onDragOver={(e) => { e.preventDefault(); if (overType !== section.type) setOverType(section.type); }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setOverType(null); }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              setOverType(null);
              setDragId(null);
              if (id) move(id, section.type);
            }}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${isOver ? 'border-brand ring-2 ring-brand/20' : 'border-slate-200'}`}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <section.Icon size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold">{section.label}</h2>
              <span className="text-xs text-slate-400">· {rows.length}</span>
            </div>
            {rows.length === 0 ? (
              <div className={`px-5 py-10 text-center text-sm ${isOver ? 'text-brand' : 'text-slate-400'}`}>
                {isOver ? 'Drop to move here' : 'None yet — drag statements here.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {rows.map((p, idx) => {
                  const showYear = p.year > 0 && (idx === 0 || rows[idx - 1].year !== p.year);
                  return (
                    <Fragment key={p.id}>
                      {showYear && <div className="bg-slate-50/70 px-5 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{p.year}</div>}
                      <div
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setDragId(p.id); }}
                        onDragEnd={() => { setDragId(null); setOverType(null); }}
                        className={`flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50 ${dragId === p.id ? 'opacity-40' : ''}`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <GripVertical size={14} className="shrink-0 cursor-grab text-slate-300" />
                          <Link href={`/finance/import/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                            <FileText size={16} className="shrink-0 text-slate-400" />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-800">{p.period || p.accountLabel}</div>
                              <div className="truncate text-xs text-slate-400">{p.fileName}</div>
                            </div>
                          </Link>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <PendingTypeToggle id={p.id} type={p.accountType} />
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{p.count}</span>
                          <Link href={`/finance/import/${p.id}`} className="text-slate-300 transition hover:text-slate-500"><ChevronRight size={16} /></Link>
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
