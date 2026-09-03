'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ExternalLink, ThumbsUp, X as XIcon, RefreshCw } from 'lucide-react';
import { setTweetRelevance, setTweetStatus, pollTweetsNow } from '@/app/leads/actions';

export type SignalTweet = {
  id: string;
  url: string;
  text: string;
  authorHandle: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  postedAt: string | null;
  aiScore: number | null;
};

function ago(iso: string | null): string {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
function scoreClass(n: number | null) {
  if (n == null) return 'bg-slate-100 text-slate-400';
  if (n >= 65) return 'bg-emerald-50 text-emerald-700';
  if (n >= 40) return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-500';
}
function XLogo() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" className="text-slate-800" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function DashboardSignals({ tweets }: { tweets: SignalTweet[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  const fetchTweets = () => start(async () => { const r: any = await pollTweetsNow(); if (r?.ok) window.dispatchEvent(new CustomEvent('keel:poll-started')); });

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <XLogo />
          <h2 className="text-sm font-semibold">Inbound signals</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchTweets} disabled={pending} title="Fetch tweets" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={13} className={pending ? 'animate-spin' : ''} /> Fetch
          </button>
          <Link href="/leads/x" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
            See all <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {tweets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10 text-center text-sm text-slate-400">
          No signals yet.
          <Link href="/leads/x" className="font-medium text-brand hover:underline">Add keywords &amp; fetch tweets →</Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {tweets.map((t) => {
            const handle = t.authorHandle ? `@${t.authorHandle}` : 'unknown';
            return (
              <li key={t.id} className="group flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {t.authorAvatar ? <img src={t.authorAvatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" /> : <div className="h-7 w-7 shrink-0 rounded-full bg-slate-200" />}
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${scoreClass(t.aiScore)}`}>{t.aiScore ?? '—'}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-slate-400">{t.authorName ?? handle} <span className="text-slate-300">·</span> {handle}{t.postedAt ? ` · ${ago(t.postedAt)}` : ''}</div>
                  <div className="truncate text-sm text-slate-700">{t.text}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => run(() => setTweetRelevance(t.id, 'yes'))} disabled={pending} title="Mark relevant" className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-emerald-600 disabled:opacity-50"><ThumbsUp size={13} /></button>
                  <button onClick={() => run(() => setTweetStatus(t.id, 'ignored'))} disabled={pending} title="Ignore" className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 disabled:opacity-50"><XIcon size={13} /></button>
                </div>
                <a href={t.url} target="_blank" rel="noreferrer" onClick={() => run(() => setTweetStatus(t.id, 'contacted'))} title="Open on X" className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark">
                  Open <ExternalLink size={11} />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
