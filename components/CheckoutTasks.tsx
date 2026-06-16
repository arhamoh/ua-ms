'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { TASK_STATUS_DOT, TASK_STATUS_LABELS } from '@/lib/enums';

export type CheckoutTask = {
  taskId: string;
  title: string;
  project: string | null;
  status: string;
};

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

// Builds the saved "tasks done" text from the user's selections. Checked board
// tasks are listed by title (with project), then any free-typed extras.
function compose(items: CheckoutTask[], checked: Record<string, boolean>, extras: string[]) {
  const lines = items
    .filter((t) => checked[t.taskId])
    .map((t) => `• ${t.title}${t.project ? ` — ${t.project}` : ''}`);
  for (const e of extras) {
    const v = e.trim();
    if (v) lines.push(`• ${v}`);
  }
  return lines.join('\n');
}

/**
 * Interactive checkout checklist. Instead of dumping a "moved X to Done" log into
 * a textarea, it shows the tasks the person touched today as toggle rows — tasks
 * that ended in Done are pre-checked — plus free-text rows for anything off-board.
 * Emits the composed summary string via `onChange` for the parent to submit.
 */
export default function CheckoutTasks({
  items,
  loading,
  onChange,
}: {
  items: CheckoutTask[];
  loading: boolean;
  onChange: (composed: string) => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [extras, setExtras] = useState<string[]>(['']);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Seed selections when tasks load: tasks that ended in Done are pre-checked.
  useEffect(() => {
    const init: Record<string, boolean> = {};
    for (const t of items) init[t.taskId] = t.status === 'DONE';
    setChecked(init);
  }, [items]);

  // Re-compose and report up whenever a selection or extra changes.
  useEffect(() => {
    onChangeRef.current(compose(items, checked, extras));
  }, [items, checked, extras]);

  const toggle = (id: string) => setChecked((c) => ({ ...c, [id]: !c[id] }));
  const setExtra = (i: number, v: string) =>
    setExtras((arr) => arr.map((x, j) => (j === i ? v : x)));
  const addExtra = () => setExtras((arr) => [...arr, '']);
  const removeExtra = (i: number) =>
    setExtras((arr) => (arr.length === 1 ? [''] : arr.filter((_, j) => j !== i)));

  const doneCount = items.filter((t) => checked[t.taskId]).length;

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
        <Sparkles size={13} className="text-brand" /> What did you get done?
        {loading && <Loader2 size={12} className="animate-spin text-slate-400" />}
        {!loading && items.length > 0 && (
          <span className="ml-auto text-[11px] font-normal text-slate-400">
            {doneCount}/{items.length} selected
          </span>
        )}
      </div>

      {/* Board tasks touched since check-in — tap to toggle done */}
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((t) => {
            const on = !!checked[t.taskId];
            return (
              <li key={t.taskId}>
                <button
                  type="button"
                  onClick={() => toggle(t.taskId)}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition ${
                    on
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition ${
                      on ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className={`flex-1 truncate ${on ? 'text-emerald-900' : 'text-slate-700'}`}>
                    {t.title}
                    {t.project && <span className="text-slate-400"> · {t.project}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${TASK_STATUS_DOT[t.status] ?? 'bg-slate-300'}`} />
                    {TASK_STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
          No task-board activity since check-in — jot down what you worked on below.
        </p>
      )}

      {/* Free-text extras for anything not on the board */}
      <div className="mt-2.5 space-y-1.5">
        {extras.map((val, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={val}
              onChange={(e) => setExtra(i, e.target.value)}
              placeholder={i === 0 ? 'Add anything else you did…' : 'Another item…'}
              className={inputCls}
            />
            {(extras.length > 1 || val.trim()) && (
              <button
                type="button"
                onClick={() => removeExtra(i)}
                aria-label="Remove item"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addExtra}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          <Plus size={13} /> Add another
        </button>
      </div>
    </div>
  );
}
