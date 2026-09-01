'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ChevronLeft, ChevronRight, Pencil, CalendarClock } from 'lucide-react';
import { addLetterTask, setLetterTaskStatus, updateLetterTask, deleteLetterTask } from '@/app/actions';

type Task = { id: string; title: string; detail: string | null; status: string; dueDate: string | null };
type Run = (fn: () => Promise<unknown>) => void;

const COLUMNS = [
  { key: 'TODO', label: 'To do' },
  { key: 'DOING', label: 'In progress' },
  { key: 'DONE', label: 'Done' },
];
const NEXT: Record<string, string> = { TODO: 'DOING', DOING: 'DONE' };
const PREV: Record<string, string> = { DONE: 'DOING', DOING: 'TODO' };

function overdue(due: string | null, status: string) {
  if (!due || status === 'DONE') return false;
  return new Date(`${due}T23:59:59`) < new Date();
}

function TaskCard({ task, run, pending }: { task: Task; run: Run; pending: boolean }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [detail, setDetail] = useState(task.detail ?? '');
  const [due, setDue] = useState(task.dueDate ?? '');
  const od = overdue(task.dueDate, task.status);

  if (editing) {
    return (
      <div className="rounded-xl border border-brand/40 bg-white p-3 shadow-sm">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="mb-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-brand focus:outline-none" />
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} placeholder="Details" className="mb-2 w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand focus:outline-none" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="mb-2 w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand focus:outline-none" />
        <div className="flex justify-end gap-1.5">
          <button onClick={() => setEditing(false)} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            disabled={pending || !title.trim()}
            onClick={() => {
              run(() => updateLetterTask(task.id, { title, detail: detail || null, dueDate: due || null }));
              setEditing(false);
            }}
            className="rounded-md bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className={task.status === 'DONE' ? 'text-sm text-slate-400 line-through' : 'text-sm font-medium text-slate-800'}>{task.title}</p>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={() => { setTitle(task.title); setDetail(task.detail ?? ''); setDue(task.dueDate ?? ''); setEditing(true); }}
            title="Edit" className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil size={13} />
          </button>
          <button onClick={() => run(() => deleteLetterTask(task.id))} title="Delete" className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {task.detail && <p className="mt-1 text-xs leading-relaxed text-slate-500">{task.detail}</p>}
      <div className="mt-2 flex items-center justify-between">
        <span>
          {task.dueDate && (
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${od ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
              <CalendarClock size={11} /> {task.dueDate}{od ? ' · overdue' : ''}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {PREV[task.status] && (
            <button onClick={() => run(() => setLetterTaskStatus(task.id, PREV[task.status]))} title="Move back" className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <ChevronLeft size={14} />
            </button>
          )}
          {NEXT[task.status] && (
            <button onClick={() => run(() => setLetterTaskStatus(task.id, NEXT[task.status]))} title="Move forward" className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LetterBoard({ letterId, tasks }: { letterId: string; tasks: Task[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newTitle, setNewTitle] = useState('');

  const run: Run = (fn) => start(async () => { await fn(); router.refresh(); });

  const add = () => {
    const t = newTitle.trim();
    if (!t) return;
    setNewTitle('');
    run(() => addLetterTask(letterId, t, null, null));
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col.key);
        return (
          <div key={col.key} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{col.label}</h3>
              <span className="text-xs text-slate-400">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((t) => <TaskCard key={t.id} task={t} run={run} pending={pending} />)}
              {col.key === 'TODO' ? (
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                    placeholder="Add a task…"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
                  />
                  <button onClick={add} disabled={pending || !newTitle.trim()} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-50">
                    <Plus size={16} />
                  </button>
                </div>
              ) : (
                items.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-400">Nothing here yet.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
