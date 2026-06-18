'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  KeyRound, Plus, Search, Eye, EyeOff, Copy, Check, ExternalLink, Pencil, Trash2, X, Users, Loader2,
} from 'lucide-react';
import { createLogin, updateLogin, deleteLogin, revealLogin } from '@/app/actions';
import { ROLE_LABELS } from '@/lib/enums';

export type LoginItem = {
  id: string;
  name: string;
  url: string | null;
  username: string | null;
  notes: string | null;
  createdBy: string | null;
  sharedWith: { id: string; name: string }[];
};
type TeamUser = { id: string; name: string; roles: string[] };

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

export default function LoginsManager({
  items,
  users,
  canManage,
}: {
  items: LoginItem[];
  users: TeamUser[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<LoginItem | 'new' | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState('');
  const [, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((l) =>
      [l.name, l.url, l.username].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [items, query]);

  const reveal = (id: string) =>
    start(async () => {
      const p = await revealLogin(id);
      setRevealed((r) => ({ ...r, [id]: p }));
    });
  const hide = (id: string) => setRevealed((r) => ({ ...r, [id]: undefined as unknown as string }));

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1200);
    } catch {
      /* ignore */
    }
  };
  const copyPassword = (id: string) =>
    start(async () => {
      const p = revealed[id] ?? (await revealLogin(id));
      setRevealed((r) => ({ ...r, [id]: p }));
      await copy(`pw-${id}`, p);
    });

  const remove = (id: string) =>
    start(async () => {
      const fd = new FormData();
      fd.set('id', id);
      await deleteLogin(fd);
      router.refresh();
    });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search logins…"
            className={`${inputCls} pl-9`}
          />
        </div>
        {canManage && (
          <button
            onClick={() => setEditing('new')}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
          >
            <Plus size={16} /> Add login
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {items.length === 0
            ? canManage
              ? 'No logins yet. Add your first shared credential.'
              : 'No logins have been shared with you yet.'
            : 'No logins match your search.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((l) => {
            const pw = revealed[l.id];
            return (
              <div key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-light text-brand">
                      <KeyRound size={16} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-800">{l.name}</h3>
                      {l.url && (
                        <a
                          href={/^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 truncate text-xs text-brand hover:underline"
                        >
                          {l.url} <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => setEditing(l)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => remove(l.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-1.5">
                  <Field label="Username" value={l.username} copyKey={`u-${l.id}`} copied={copied} onCopy={copy} />
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <span className="w-20 shrink-0 text-xs font-medium text-slate-400">Password</span>
                    <span className="flex-1 truncate font-mono text-sm text-slate-700">
                      {pw != null ? pw || '—' : '••••••••••'}
                    </span>
                    <button onClick={() => (pw != null ? hide(l.id) : reveal(l.id))} className="rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Reveal">
                      {pw != null ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button onClick={() => copyPassword(l.id)} className="rounded p-1 text-slate-400 hover:text-brand" aria-label="Copy password">
                      {copied === `pw-${l.id}` ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                  {l.notes && <p className="px-2.5 pt-1 text-xs text-slate-500">{l.notes}</p>}
                </div>

                {canManage && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                    <Users size={13} className="text-slate-400" />
                    {l.sharedWith.length === 0 ? (
                      <span className="text-xs text-slate-400">Not shared with anyone</span>
                    ) : (
                      l.sharedWith.map((u) => (
                        <span key={u.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {u.name}
                        </span>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <LoginForm
          login={editing === 'new' ? null : editing}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Field({
  label, value, copyKey, copied, onCopy,
}: {
  label: string; value: string | null; copyKey: string; copied: string; onCopy: (k: string, v: string) => void;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
      <span className="w-20 shrink-0 text-xs font-medium text-slate-400">{label}</span>
      <span className="flex-1 truncate text-sm text-slate-700">{value}</span>
      <button onClick={() => onCopy(copyKey, value)} className="rounded p-1 text-slate-400 hover:text-brand" aria-label={`Copy ${label}`}>
        {copied === copyKey ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function LoginForm({
  login, users, onClose, onSaved,
}: {
  login: LoginItem | null;
  users: TeamUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [showPw, setShowPw] = useState(false);
  const sharedIds = new Set(login?.sharedWith.map((u) => u.id) ?? []);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      if (login) await updateLogin(fd);
      else await createLogin(fd);
      onSaved();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[8vh]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
        <h2 className="text-base font-semibold tracking-tight">{login ? 'Edit login' : 'Add login'}</h2>
        {login && <input type="hidden" name="id" value={login.id} />}

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Name *</span>
            <input name="name" required defaultValue={login?.name ?? ''} className={inputCls} placeholder="e.g. Client WordPress admin" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">URL</span>
            <input name="url" defaultValue={login?.url ?? ''} className={inputCls} placeholder="https://example.com/wp-admin" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Username</span>
            <input name="username" defaultValue={login?.username ?? ''} className={inputCls} placeholder="admin@example.com" autoComplete="off" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Password {login && <span className="font-normal text-slate-400">— leave blank to keep current</span>}</span>
            <div className="flex items-center gap-2">
              <input
                name="password"
                type={showPw ? 'text' : 'password'}
                className={inputCls}
                placeholder={login ? '••••••••' : 'Password'}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="shrink-0 rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50" aria-label="Toggle">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Notes</span>
            <input name="notes" defaultValue={login?.notes ?? ''} className={inputCls} placeholder="Anything to remember" />
          </label>

          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Users size={13} /> Share with
            </span>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {users.length === 0 && <p className="px-1 text-xs text-slate-400">No team members yet.</p>}
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50">
                  <input type="checkbox" name="shareUserIds" value={u.id} defaultChecked={sharedIds.has(u.id)} className="rounded border-slate-300" />
                  <span className="text-slate-700">{u.name}</span>
                  <span className="ml-auto text-[11px] text-slate-400">
                    {u.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50">
            {pending && <Loader2 size={15} className="animate-spin" />}
            {login ? 'Save changes' : 'Add login'}
          </button>
        </div>
      </form>
    </div>
  );
}
