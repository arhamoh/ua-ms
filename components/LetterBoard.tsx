'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ChevronLeft, ChevronRight, Pencil, CalendarClock, Paperclip, Upload, Archive, X, MessageSquare, FileBarChart, Landmark, CreditCard, Check } from 'lucide-react';
import {
  addLetterTask,
  setLetterTaskStatus,
  updateLetterTask,
  deleteLetterTask,
  setLetterTaskResponse,
  addTaskUpload,
  attachStatementsToTask,
  removeTaskAttachment,
  generateFinanceReport,
} from '@/app/actions';
import { REPORT_TYPES, type ReportType } from '@/lib/finance-reports';

type Attachment = { id: string; fileName: string; kind: string };
type Task = {
  id: string;
  title: string;
  titleFr: string | null;
  detail: string | null;
  detailFr: string | null;
  status: string;
  dueDate: string | null;
  response: string | null;
  attachments: Attachment[];
};
type Statement = { id: string; fileName: string; label: string; accountType: string; year: number; month: number };
type Run = (fn: () => Promise<unknown>) => void;

const QUARTERS = [
  { q: 1, label: 'Q1 · Jan–Mar', from: '01', to: '03' },
  { q: 2, label: 'Q2 · Apr–Jun', from: '04', to: '06' },
  { q: 3, label: 'Q3 · Jul–Sep', from: '07', to: '09' },
  { q: 4, label: 'Q4 · Oct–Dec', from: '10', to: '12' },
];

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

function AnswerPanel({ task, statements, run, pending }: { task: Task; statements: Statement[]; run: Run; pending: boolean }) {
  const thisYear = new Date().getFullYear();
  const [response, setResponse] = useState(task.response ?? '');
  const [pickStatement, setPickStatement] = useState(false);
  const [pickedStmts, setPickedStmts] = useState<Set<string>>(new Set());
  const [showReport, setShowReport] = useState(false);
  const [rType, setRType] = useState<ReportType>('gst_collected');
  const [rYear, setRYear] = useState(thisYear);
  const [rQuarters, setRQuarters] = useState<Set<number>>(new Set());
  const [rTopN, setRTopN] = useState('5');
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = response.trim() !== (task.response ?? '').trim();
  const hasTopN = REPORT_TYPES.find((r) => r.value === rType)?.hasTopN;
  const clamp = () => Math.max(1, Math.min(100, Number(rTopN) || 5));

  const toggleQ = (q: number) => setRQuarters((s) => { const n = new Set(s); n.has(q) ? n.delete(q) : n.add(q); return n; });
  const togglePicked = (id: string) => setPickedStmts((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const genReport = () => {
    const qs = [...rQuarters].sort();
    run(async () => {
      if (qs.length === 0) {
        await generateFinanceReport(task.id, { type: rType, from: null, to: null, topN: hasTopN ? clamp() : undefined });
      } else {
        for (const q of qs) {
          const def = QUARTERS.find((x) => x.q === q)!;
          await generateFinanceReport(task.id, { type: rType, from: `${rYear}-${def.from}`, to: `${rYear}-${def.to}`, topN: hasTopN ? clamp() : undefined });
        }
      }
    });
    setShowReport(false);
    setRQuarters(new Set());
  };

  const genAllQuarters = () => {
    run(async () => {
      for (const def of QUARTERS) {
        await generateFinanceReport(task.id, { type: rType, from: `${rYear}-${def.from}`, to: `${rYear}-${def.to}`, topN: hasTopN ? clamp() : undefined });
      }
    });
    setShowReport(false);
    setRQuarters(new Set());
  };

  const attachPicked = () => {
    if (pickedStmts.size === 0) return;
    const ids = [...pickedStmts];
    run(() => attachStatementsToTask(task.id, ids));
    setPickStatement(false);
    setPickedStmts(new Set());
  };

  const upload = (file: File) => {
    const fd = new FormData();
    fd.set('taskId', task.id);
    fd.set('file', file);
    run(() => addTaskUpload(fd));
  };

  return (
    <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
      <div>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Answer</label>
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={3}
          placeholder="Write your answer to this question…"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs leading-relaxed focus:border-brand focus:outline-none"
        />
        {dirty && (
          <div className="mt-1 flex justify-end gap-1.5">
            <button onClick={() => setResponse(task.response ?? '')} className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">Reset</button>
            <button
              disabled={pending}
              onClick={() => run(() => setLetterTaskResponse(task.id, response))}
              className="rounded-md bg-brand px-2 py-1 text-[11px] font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              Save answer
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Documents</label>
        {task.attachments.length > 0 && (
          <ul className="mb-1.5 space-y-1">
            {task.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
                <Paperclip size={12} className="shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate">{a.fileName}</span>
                <span className={`shrink-0 rounded px-1 text-[10px] font-medium ${a.kind === 'STATEMENT' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                  {a.kind === 'STATEMENT' ? 'Statement' : 'Upload'}
                </span>
                <button onClick={() => run(() => removeTaskAttachment(a.id))} title="Remove" className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-300 hover:bg-rose-50 hover:text-rose-600">
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <Upload size={12} /> Upload
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
          />
          <button
            onClick={() => setPickStatement((v) => !v)}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <Archive size={12} /> From statements
          </button>
          <button
            onClick={() => setShowReport((v) => !v)}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <FileBarChart size={12} /> Finance report
          </button>
        </div>
        {showReport && (
          <div className="mt-1.5 space-y-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
            <select value={rType} onChange={(e) => setRType(e.target.value as ReportType)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-brand focus:outline-none">
              {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-medium uppercase text-slate-400">Year
                <select value={rYear} onChange={(e) => setRYear(Number(e.target.value))} className="ml-1 rounded-md border border-slate-300 px-1.5 py-1 text-xs focus:border-brand focus:outline-none">
                  {[thisYear, thisYear - 1, thisYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              {hasTopN && (
                <label className="ml-auto text-[10px] font-medium uppercase text-slate-400">Top
                  <input type="number" min={1} max={100} value={rTopN} onChange={(e) => setRTopN(e.target.value)} className="ml-1 w-14 rounded-md border border-slate-300 px-1.5 py-1 text-xs focus:border-brand focus:outline-none" />
                </label>
              )}
            </div>
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase text-slate-400">Quarters (one Excel + PDF each)</div>
              <div className="flex flex-wrap gap-1">
                {QUARTERS.map((q) => (
                  <button key={q.q} onClick={() => toggleQ(q.q)} className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${rQuarters.has(q.q) ? 'border-brand bg-brand-light text-brand' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                    {q.label.split(' · ')[0]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400">{rQuarters.size ? `${rQuarters.size} quarter${rQuarters.size === 1 ? '' : 's'} of ${rYear}` : 'No quarter = all data'}</span>
              <div className="flex gap-1.5">
                <button onClick={genAllQuarters} disabled={pending} title={`Generate a ledger for each quarter of ${rYear}`} className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  All {rYear} (Q1–Q4)
                </button>
                <button onClick={genReport} disabled={pending} className="rounded-md bg-brand px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-dark disabled:opacity-50">
                  {pending ? 'Generating…' : 'Generate & attach'}
                </button>
              </div>
            </div>
          </div>
        )}
        {pickStatement && (
          statements.length > 0 ? (
            <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="max-h-64 overflow-auto p-1.5">
                {([['BANK', 'Bank accounts', Landmark], ['CREDIT_CARD', 'Credit cards', CreditCard]] as const).map(([type, label, Icon]) => {
                  const group = statements
                    .filter((s) => (type === 'CREDIT_CARD' ? s.accountType === 'CREDIT_CARD' : s.accountType !== 'CREDIT_CARD'))
                    .sort((a, b) => (b.year - a.year) || (b.month - a.month) || a.label.localeCompare(b.label));
                  if (group.length === 0) return null;
                  return (
                    <div key={type} className="mb-1">
                      <div className="flex items-center gap-1.5 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><Icon size={11} /> {label}</div>
                      {group.map((s) => (
                        <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-slate-50">
                          <input type="checkbox" checked={pickedStmts.has(s.id)} onChange={() => togglePicked(s.id)} className="rounded border-slate-300" />
                          <span className="min-w-0 flex-1 truncate text-slate-700">{s.label}</span>
                          {s.year > 0 && <span className="shrink-0 text-[10px] text-slate-400">{s.year}</span>}
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2 py-1.5">
                <span className="text-[10px] text-slate-400">{pickedStmts.size} selected</span>
                <div className="flex gap-1.5">
                  <button onClick={() => { setPickStatement(false); setPickedStmts(new Set()); }} className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button onClick={attachPicked} disabled={pending || pickedStmts.size === 0} className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-dark disabled:opacity-50">
                    <Check size={11} /> Attach {pickedStmts.size || ''}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-1.5 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] text-slate-400">
              No statements in your archive yet — upload one under Finance → Import, or use Upload above.
            </p>
          )
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  statements,
  run,
  pending,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  statements: Statement[];
  run: Run;
  pending: boolean;
  dragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const canDrag = !editing && !open;
  const [title, setTitle] = useState(task.title);
  const [detail, setDetail] = useState(task.detail ?? '');
  const [due, setDue] = useState(task.dueDate ?? '');
  const od = overdue(task.dueDate, task.status);
  const answered = !!task.response?.trim() || task.attachments.length > 0;

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
    <div
      draggable={canDrag}
      onDragStart={(e) => { if (!canDrag) return; e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(task.id); }}
      onDragEnd={onDragEnd}
      className={`group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={task.status === 'DONE' ? 'text-sm text-slate-400 line-through' : 'text-sm font-medium text-slate-800'}>{task.title}</p>
          {task.titleFr && <p className="mt-0.5 text-xs italic text-slate-500">{task.titleFr}</p>}
        </div>
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
        <div className="flex items-center gap-1.5">
          {task.dueDate && (
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${od ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
              <CalendarClock size={11} /> {task.dueDate}{od ? ' · overdue' : ''}
            </span>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium transition ${answered ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <MessageSquare size={11} /> {answered ? 'Answered' : 'Answer'}
            {task.attachments.length > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip size={10} />{task.attachments.length}</span>}
          </button>
        </div>
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
      {open && <AnswerPanel task={task} statements={statements} run={run} pending={pending} />}
    </div>
  );
}

export default function LetterBoard({ letterId, tasks, statements }: { letterId: string; tasks: Task[]; statements: Statement[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newTitle, setNewTitle] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const run: Run = (fn) => start(async () => { await fn(); router.refresh(); });

  const move = (id: string, status: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    run(() => setLetterTaskStatus(id, status));
  };

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
        const isOver = overCol === col.key;
        return (
          <div
            key={col.key}
            onDragOver={(e) => { if (!dragId) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overCol !== col.key) setOverCol(col.key); }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setOverCol(null); }}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || dragId; setOverCol(null); setDragId(null); if (id) move(id, col.key); }}
            className={`rounded-2xl border p-3 transition ${isOver ? 'border-brand bg-brand-light/40 ring-2 ring-brand/20' : 'border-slate-200 bg-slate-50/60'}`}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{col.label}</h3>
              <span className="text-xs text-slate-400">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  statements={statements}
                  run={run}
                  pending={pending}
                  dragging={dragId === t.id}
                  onDragStart={setDragId}
                  onDragEnd={() => { setDragId(null); setOverCol(null); }}
                />
              ))}
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
