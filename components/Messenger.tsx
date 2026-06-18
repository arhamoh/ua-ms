'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  MessageSquare, Plus, Send, ArrowLeft, Users, X, Search, Loader2, Check,
  MoreVertical, Trash2, Mail, MailOpen,
} from 'lucide-react';
import { createConversation, sendMessage, deleteConversation, setConversationRead } from '@/app/actions';

type TeamUser = { id: string; name: string };
type ConvoSummary = {
  id: string;
  isGroup: boolean;
  name: string;
  members: TeamUser[];
  unread: number;
  lastMessage: { body: string; createdAt: string; senderName: string } | null;
};
type Msg = { id: string; body: string; createdAt: string; senderId: string | null; senderName: string; mine: boolean };

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function Messenger({ me, users, initialConversationId = null }: { me: TeamUser; users: TeamUser[]; initialConversationId?: string | null }) {
  const [convos, setConvos] = useState<ConvoSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;

  const loadConvos = useCallback(async () => {
    try {
      const res = await fetch('/api/messages', { cache: 'no-store' });
      const data = await res.json();
      setConvos(data.conversations ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/messages?conversationId=${id}`, { cache: 'no-store' });
      const data = await res.json();
      if (activeRef.current === id) setMessages(data.messages ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  // Initial + polling: refresh the list always, and the open thread if any.
  useEffect(() => {
    loadConvos();
    const t = setInterval(() => {
      loadConvos();
      if (activeRef.current) loadThread(activeRef.current);
    }, 4000);
    return () => clearInterval(t);
  }, [loadConvos, loadThread]);

  // Open a conversation.
  useEffect(() => {
    if (activeId) {
      setMessages([]);
      loadThread(activeId);
      loadConvos();
    }
  }, [activeId, loadThread, loadConvos]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  // Close the per-conversation menu on any outside click.
  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuId]);

  const toggleRead = (c: ConvoSummary) =>
    start(async () => {
      setMenuId(null);
      await setConversationRead(c.id, c.unread > 0); // unread>0 → mark read; else mark unread
      await loadConvos();
    });

  const remove = (c: ConvoSummary) =>
    start(async () => {
      setMenuId(null);
      await deleteConversation(c.id);
      if (activeRef.current === c.id) setActiveId(null);
      await loadConvos();
    });

  const active = convos.find((c) => c.id === activeId) ?? null;

  const send = () => {
    const text = input.trim();
    if (!text || !activeId) return;
    setInput('');
    // optimistic
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, body: text, createdAt: new Date().toISOString(), senderId: me.id, senderName: me.name, mine: true }]);
    start(async () => {
      await sendMessage(activeId, text);
      await loadThread(activeId);
      await loadConvos();
    });
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* List */}
      <aside className={`w-full shrink-0 flex-col border-r border-slate-200 sm:flex sm:w-72 ${activeId ? 'hidden sm:flex' : 'flex'}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare size={15} className="text-brand" /> Messages</h2>
          <button onClick={() => setNewOpen(true)} className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-white hover:bg-brand-dark" aria-label="New conversation">
            <Plus size={15} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {convos.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-slate-400">No conversations yet. Start one with “+”.</div>
          ) : (
            convos.map((c) => (
              <div key={c.id} className="group relative">
                <button
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 ${activeId === c.id ? 'bg-brand-light/40' : ''}`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${c.isGroup ? 'bg-slate-200 text-slate-600' : 'bg-brand-light text-brand'}`}>
                    {c.isGroup ? <Users size={15} /> : initials(c.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${c.unread > 0 ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>{c.name}</span>
                      {c.lastMessage && <span className="shrink-0 text-[10px] text-slate-400 group-hover:invisible">{clockTime(c.lastMessage.createdAt)}</span>}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-xs ${c.unread > 0 ? 'text-slate-700' : 'text-slate-500'}`}>
                        {c.lastMessage ? `${c.isGroup ? `${c.lastMessage.senderName.split(' ')[0]}: ` : ''}${c.lastMessage.body}` : 'No messages yet'}
                      </span>
                      {c.unread > 0 && <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">{c.unread > 20 ? '20+' : c.unread}</span>}
                    </span>
                  </span>
                </button>

                {/* Actions menu */}
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuId(menuId === c.id ? null : c.id); }}
                  className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-lg bg-white/90 p-1 text-slate-400 shadow-sm hover:text-slate-700 group-hover:block"
                  aria-label="Conversation options"
                >
                  <MoreVertical size={15} />
                </button>
                {menuId === c.id && (
                  <div onClick={(e) => e.stopPropagation()} className="absolute right-2 top-10 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl">
                    <button onClick={() => toggleRead(c)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50">
                      {c.unread > 0 ? <><MailOpen size={14} /> Mark as read</> : <><Mail size={14} /> Mark as unread</>}
                    </button>
                    <button onClick={() => remove(c)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-rose-600 hover:bg-rose-50">
                      <Trash2 size={14} /> Delete conversation
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={`min-w-0 flex-1 flex-col ${activeId ? 'flex' : 'hidden sm:flex'}`}>
        {!active ? (
          <div className="grid flex-1 place-items-center text-center text-sm text-slate-400">
            <div>
              <MessageSquare size={28} className="mx-auto text-slate-300" />
              <p className="mt-2">Select a conversation</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <button onClick={() => setActiveId(null)} className="sm:hidden" aria-label="Back"><ArrowLeft size={18} className="text-slate-500" /></button>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${active.isGroup ? 'bg-slate-200 text-slate-600' : 'bg-brand-light text-brand'}`}>
                {active.isGroup ? <Users size={14} /> : initials(active.name)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{active.name}</div>
                {active.isGroup && <div className="truncate text-[11px] text-slate-400">{active.members.map((m) => m.name.split(' ')[0]).join(', ')}</div>}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${m.mine ? 'bg-brand text-white' : 'bg-slate-100 text-slate-800'}`}>
                    {active.isGroup && !m.mine && <div className="mb-0.5 text-[11px] font-semibold text-brand">{m.senderName.split(' ')[0]}</div>}
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className={`mt-0.5 text-[10px] ${m.mine ? 'text-white/70' : 'text-slate-400'}`}>{clockTime(m.createdAt)}</div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="border-t border-slate-100 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  rows={1}
                  placeholder="Type a message…"
                  className="max-h-32 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
                <button onClick={send} disabled={!input.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white transition hover:bg-brand-dark disabled:opacity-40" aria-label="Send">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {newOpen && (
        <NewConversation
          users={users.filter((u) => u.id !== me.id)}
          onClose={() => setNewOpen(false)}
          onCreated={(id) => { setNewOpen(false); setActiveId(id); loadConvos(); }}
        />
      )}
    </div>
  );
}

function NewConversation({ users, onClose, onCreated }: { users: TeamUser[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [pending, start] = useTransition();
  const isGroup = selected.length > 1;

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const filtered = users.filter((u) => u.name.toLowerCase().includes(query.trim().toLowerCase()));

  const create = () => {
    if (!selected.length) return;
    start(async () => {
      const res = await createConversation(selected, isGroup, isGroup ? title : undefined);
      if (res?.id) onCreated(res.id);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        <h2 className="text-base font-semibold tracking-tight">New conversation</h2>
        <p className="mt-0.5 text-sm text-slate-500">Pick one person for a DM, or several for a group.</p>

        {isGroup && (
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Group name (optional)" className={`mt-4 ${inputCls}`} />
        )}
        <div className="relative mt-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search teammates…" className={`${inputCls} pl-9`} />
        </div>
        <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
          {filtered.map((u) => {
            const on = selected.includes(u.id);
            return (
              <button key={u.id} onClick={() => toggle(u.id)} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition ${on ? 'bg-brand-light/50' : 'hover:bg-slate-50'}`}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">{initials(u.name)}</span>
                <span className="flex-1 text-slate-700">{u.name}</span>
                {on && <Check size={15} className="text-brand" />}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={create} disabled={pending || !selected.length} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50">
            {pending && <Loader2 size={15} className="animate-spin" />}
            {isGroup ? `Start group (${selected.length})` : 'Start chat'}
          </button>
        </div>
      </div>
    </div>
  );
}
