'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { MessageCircle, Check, RotateCcw, Trash2, CornerDownRight, Send } from 'lucide-react';
import { createCommentThread, replyToThread, resolveThread, deleteCommentThread } from '@/app/actions';

type Comment = { id: string; body: string; createdAt: string; authorId: string | null; authorName: string };
type Thread = { id: string; resolved: boolean; createdById: string | null; comments: Comment[] };

function ago(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d` : new Date(iso).toLocaleDateString();
}
function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
// Highlight @mentions in a comment body.
function renderBody(body: string) {
  return body.split(/(\s+)/).map((tok, i) =>
    tok.startsWith('@') && tok.length > 1 ? <span key={i} className="font-medium text-brand">{tok}</span> : <span key={i}>{tok}</span>,
  );
}

export default function CommentThreads({
  entityType,
  entityId,
  href,
  meId,
  isAdmin = false,
}: {
  entityType: string;
  entityId: string;
  href: string;
  meId: string;
  isAdmin?: boolean;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [newBody, setNewBody] = useState('');
  const [replyBody, setReplyBody] = useState<Record<string, string>>({});
  const [showResolved, setShowResolved] = useState(false);
  const [, start] = useTransition();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?entityType=${entityType}&entityId=${entityId}`, { cache: 'no-store' });
      const data = await res.json();
      setThreads(data.threads ?? []);
    } catch {
      /* ignore */
    }
  }, [entityType, entityId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  const addThread = () => {
    const body = newBody.trim();
    if (!body) return;
    setNewBody('');
    start(async () => { await createCommentThread(entityType, entityId, body, href); await load(); });
  };
  const reply = (id: string) => {
    const body = (replyBody[id] ?? '').trim();
    if (!body) return;
    setReplyBody((r) => ({ ...r, [id]: '' }));
    start(async () => { await replyToThread(id, body, href); await load(); });
  };
  const toggleResolve = (t: Thread) => start(async () => { await resolveThread(t.id, !t.resolved); await load(); });
  const remove = (id: string) => start(async () => { await deleteCommentThread(id); await load(); });

  const open = threads.filter((t) => !t.resolved);
  const resolved = threads.filter((t) => t.resolved);

  const ThreadCard = (t: Thread) => {
    const root = t.comments[0];
    const replies = t.comments.slice(1);
    const canDelete = isAdmin || t.createdById === meId;
    return (
      <div key={t.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${t.resolved ? 'border-slate-200 opacity-75' : 'border-slate-200'}`}>
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-light text-[11px] font-semibold text-brand">{root ? initials(root.authorName) : '?'}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">{root?.authorName}</span>
              <span className="text-[11px] text-slate-400">{root && ago(root.createdAt)}</span>
              {t.resolved && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Resolved</span>}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700">{root && renderBody(root.body)}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={() => toggleResolve(t)} title={t.resolved ? 'Reopen' : 'Resolve'} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600">
              {t.resolved ? <RotateCcw size={14} /> : <Check size={14} />}
            </button>
            {canDelete && (
              <button onClick={() => remove(t.id)} title="Delete thread" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
            )}
          </div>
        </div>

        {replies.length > 0 && (
          <div className="mt-3 space-y-2 border-l-2 border-slate-100 pl-4">
            {replies.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-200 text-[9px] font-semibold text-slate-600">{initials(c.authorName)}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700">{c.authorName}</span>
                    <span className="text-[10px] text-slate-400">{ago(c.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{renderBody(c.body)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 pl-4">
          <CornerDownRight size={14} className="shrink-0 text-slate-300" />
          <input
            value={replyBody[t.id] ?? ''}
            onChange={(e) => setReplyBody((r) => ({ ...r, [t.id]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); reply(t.id); } }}
            placeholder="Reply… use @name to tag"
            className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand"
          />
          <button onClick={() => reply(t.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand"><Send size={15} /></button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* New thread */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-end gap-2">
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addThread(); } }}
            rows={1}
            placeholder="Start a comment… use @name to tag someone"
            className="max-h-32 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
          />
          <button onClick={addThread} disabled={!newBody.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50">
            <MessageCircle size={15} /> Comment
          </button>
        </div>
      </div>

      {open.length === 0 && resolved.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No comments yet. Start a thread and tag teammates with @.
        </div>
      ) : (
        <div className="space-y-3">
          {open.map(ThreadCard)}
          {resolved.length > 0 && (
            <button onClick={() => setShowResolved((v) => !v)} className="text-xs font-medium text-slate-500 hover:text-brand">
              {showResolved ? 'Hide' : 'Show'} {resolved.length} resolved
            </button>
          )}
          {showResolved && resolved.map(ThreadCard)}
        </div>
      )}
    </div>
  );
}
