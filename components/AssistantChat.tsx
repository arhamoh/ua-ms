'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';
import AssistantIcon from './AssistantIcon';

type Msg = { role: 'user' | 'assistant'; content: string };

const DEFAULT_SUGGESTIONS = [
  'How are this month’s finances?',
  'Top clients by revenue',
  'Which invoices are overdue?',
  'Commission owed this month',
];

export default function AssistantChat({
  className = '',
  initialMessages = [],
  suggestions = DEFAULT_SUGGESTIONS,
  compact = false,
}: {
  className?: string;
  initialMessages?: Msg[];
  suggestions?: string[];
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const started = messages.length > 0;

  useEffect(() => {
    if (started) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, started]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || loading) return;
    const next: Msg[] = [...messages, { role: 'user', content: t }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: data.reply ?? 'No response.' }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong. Try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  const InputBox = (
    <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send(input);
          }
        }}
        rows={1}
        placeholder="Ask anything about your data…"
        className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-slate-400"
      />
      <button
        onClick={() => send(input)}
        disabled={loading || !input.trim()}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white transition hover:bg-brand-dark disabled:opacity-40"
        aria-label="Send"
      >
        <ArrowUp size={17} />
      </button>
    </div>
  );

  // ── Empty state: centered hero + suggestions ──
  if (!started) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
          <span className={`grid place-items-center rounded-2xl bg-brand-light text-brand ${compact ? 'h-12 w-12' : 'h-16 w-16'}`}>
            <AssistantIcon size={compact ? 26 : 34} />
          </span>
          <h2 className={`mt-4 font-semibold tracking-tight text-slate-900 ${compact ? 'text-lg' : 'text-2xl'}`}>
            What can I help you analyze?
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-slate-500">
            Ask about clients, projects, payments, commissions, and this month’s finances.
          </p>
          <div className="mt-6 w-full max-w-xl">{InputBox}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand/40 hover:text-brand"
              >
                <Sparkles size={12} className="text-slate-400" /> {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Conversation ──
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                m.role === 'user' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-3.5 py-2 text-sm text-slate-400">Thinking…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-slate-200 p-3">{InputBox}</div>
    </div>
  );
}
