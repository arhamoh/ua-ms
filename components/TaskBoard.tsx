'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, LayoutGrid, List as ListIcon, Calendar, Trash2 } from 'lucide-react';
import { createTask, moveTask, updateTask, deleteTask } from '@/app/actions';
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUS_DOT,
  PRIORITIES,
  PRIORITY_LABELS,
  PRIORITY_DOT,
} from '@/lib/enums';

type Tag = { id: string; name: string; color: string };
type Member = { id: string; name: string };
export type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  tags: Tag[];
};

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

function Avatar({ name }: { name: string }) {
  return (
    <span
      title={name}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600"
    >
      {initials(name)}
    </span>
  );
}

function TagChips({ tags }: { tags: Tag[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t.id}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: `${t.color}22`, color: t.color }}
        >
          {t.name}
        </span>
      ))}
    </div>
  );
}

function Card({ task, onClick, onDragStart }: { task: BoardTask; onClick: () => void; onDragStart: () => void }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand/40 hover:shadow"
    >
      <p className="text-sm font-medium text-slate-800">{task.title}</p>
      {task.tags.length > 0 && (
        <div className="mt-2">
          <TagChips tags={task.tags} />
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority] ?? 'bg-slate-300'}`} title={PRIORITY_LABELS[task.priority]} />
        {task.dueDate && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <Calendar size={11} /> {task.dueDate.slice(0, 10)}
          </span>
        )}
        <div className="ml-auto">{task.assignee && <Avatar name={task.assignee.name} />}</div>
      </div>
    </div>
  );
}

function QuickAdd({ status, onAdd }: { status: string; onAdd: (title: string) => void }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <Plus size={14} /> Add task
      </button>
    );
  }
  const submit = () => {
    const t = value.trim();
    if (t) onAdd(t);
    setValue('');
    setOpen(false);
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        rows={2}
        placeholder="Task title…"
        className="w-full resize-none text-sm outline-none"
      />
      <div className="mt-1 flex justify-end gap-1">
        <button onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
          Cancel
        </button>
        <button onClick={submit} className="rounded-md bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark">
          Add
        </button>
      </div>
    </div>
  );
}

export default function TaskBoard({
  projectId,
  initialTasks,
  members,
}: {
  projectId: string;
  initialTasks: BoardTask[];
  members: Member[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [editing, setEditing] = useState<BoardTask | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const move = (taskId: string, status: string) => {
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status } : t)));
    startTransition(async () => {
      await moveTask(taskId, status, projectId);
      router.refresh();
    });
  };

  const add = (status: string, title: string) => {
    startTransition(async () => {
      await createTask(projectId, title, status);
      router.refresh();
    });
  };

  return (
    <div>
      {/* View toggle */}
      <div className="mb-4 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
        <button
          onClick={() => setView('board')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
            view === 'board' ? 'bg-brand-light text-brand' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutGrid size={15} /> Board
        </button>
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
            view === 'list' ? 'bg-brand-light text-brand' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ListIcon size={15} /> List
        </button>
      </div>

      {view === 'board' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {TASK_STATUSES.map((status) => {
            const colTasks = tasks.filter((t) => t.status === status);
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(status);
                }}
                onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
                onDrop={() => {
                  if (dragId) move(dragId, status);
                  setDragId(null);
                  setDragOver(null);
                }}
                className={`flex w-72 shrink-0 flex-col rounded-2xl border p-3 transition ${
                  dragOver === status ? 'border-brand/40 bg-brand-light/40' : 'border-slate-200 bg-slate-100/60'
                }`}
              >
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={`h-2 w-2 rounded-full ${TASK_STATUS_DOT[status]}`} />
                  <span className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</span>
                  <span className="ml-auto text-xs text-slate-400">{colTasks.length}</span>
                </div>
                <div className="flex-1 space-y-2">
                  {colTasks.map((task) => (
                    <Card
                      key={task.id}
                      task={task}
                      onClick={() => setEditing(task)}
                      onDragStart={() => setDragId(task.id)}
                    />
                  ))}
                </div>
                <div className="mt-2">
                  <QuickAdd status={status} onAdd={(title) => add(status, title)} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ListView tasks={tasks} onOpen={setEditing} />
      )}

      <AnimatePresence>
        {editing && (
          <TaskModal
            key={editing.id}
            task={editing}
            members={members}
            projectId={projectId}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ListView({ tasks, onOpen }: { tasks: BoardTask[]; onOpen: (t: BoardTask) => void }) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No tasks yet. Switch to Board view to add some.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3 font-medium">Task</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Priority</th>
            <th className="px-5 py-3 font-medium">Assignee</th>
            <th className="px-5 py-3 font-medium">Due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((t) => (
            <tr key={t.id} className="cursor-pointer transition hover:bg-slate-50" onClick={() => onOpen(t)}>
              <td className="px-5 py-3">
                <div className="font-medium text-slate-800">{t.title}</div>
                <div className="mt-1"><TagChips tags={t.tags} /></div>
              </td>
              <td className="px-5 py-3">
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${TASK_STATUS_DOT[t.status]}`} />
                  {TASK_STATUS_LABELS[t.status]}
                </span>
              </td>
              <td className="px-5 py-3">
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                  {PRIORITY_LABELS[t.priority]}
                </span>
              </td>
              <td className="px-5 py-3 text-slate-600">{t.assignee?.name ?? '—'}</td>
              <td className="px-5 py-3 text-slate-500">{t.dueDate ? t.dueDate.slice(0, 10) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskModal({
  task,
  members,
  projectId,
  onClose,
  onSaved,
}: {
  task: BoardTask;
  members: Member[];
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [status, setStatus] = useState(task.status);
  const [assigneeId, setAssigneeId] = useState(task.assignee?.id ?? '');
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : '');
  const [tags, setTags] = useState(task.tags.map((t) => t.name).join(', '));
  const [pending, startTransition] = useTransition();

  const save = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      await updateTask(task.id, projectId, {
        title,
        description,
        status,
        assigneeId,
        priority,
        dueDate,
        tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
      });
      onSaved();
    });
  };

  const remove = () => {
    startTransition(async () => {
      await deleteTask(task.id, projectId);
      onSaved();
    });
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -8 }}
        transition={{ duration: 0.15 }}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border-b border-transparent pb-2 text-lg font-semibold outline-none focus:border-slate-200"
          placeholder="Task title"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Description…"
          className={`mt-3 ${inputCls}`}
        />

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Assignee</span>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Due date</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </label>
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Tags</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="design, urgent, frontend (comma separated)"
            className={inputCls}
          />
        </label>

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={remove}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            <Trash2 size={15} /> Delete
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
