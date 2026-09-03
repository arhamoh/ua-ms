'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Sparkles, ThumbsUp, ThumbsDown, ExternalLink, Reply, Mail, Check, X as XIcon, Plus, Heart, MessageCircle } from 'lucide-react';
import {
  pollTweetsNow,
  rescoreTweets,
  setTweetRelevance,
  setTweetStatus,
  addTweetKeyword,
  toggleTweetKeyword,
  removeTweetKeyword,
} from './actions';

export type TweetLead = {
  id: string;
  tweetId: string;
  url: string;
  text: string;
  authorHandle: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  authorId: string | null;
  likeCount: number;
  replyCount: number;
  postedAt: string | null;
  matchedQuery: string | null;
  relevance: string;
  aiScore: number | null;
  aiReason: string | null;
  status: string;
};
export type TweetKeyword = { id: string; query: string; active: boolean };

type Props = { tweetLeads: TweetLead[]; tweetKeywords: TweetKeyword[]; twitterReady: boolean };

function ago(iso: string | null): string {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
function scoreClass(n: number | null) {
  if (n == null) return 'bg-slate-100 text-slate-400';
  if (n >= 65) return 'bg-emerald-50 text-emerald-700';
  if (n >= 40) return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-500';
}

const FILTERS = ['top', 'new', 'relevant', 'all'] as const;
type Filter = (typeof FILTERS)[number];

export default function XSignals({ tweetLeads, tweetKeywords, twitterReady }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState<Filter>('top');
  const [kw, setKw] = useState('');

  const run = (fn: () => Promise<unknown>, note?: string) =>
    start(async () => {
      const r: any = await fn();
      if (note) setMsg(note);
      else if (r && r.ok === false) setMsg(`⚠️ ${r.error}`);
      else if (r && typeof r.created === 'number') setMsg(`Found ${r.created} new tweet(s) across ${r.queries} keyword(s); scored ${r.scored ?? 0}.`);
      else if (r && typeof r.scored === 'number') setMsg(`Re-scored ${r.scored} tweet(s) from what it learned.`);
      router.refresh();
    });

  const visible = useMemo(() => {
    let list = tweetLeads;
    if (filter === 'new') list = list.filter((t) => t.status === 'new' && t.relevance !== 'no');
    else if (filter === 'relevant') list = list.filter((t) => t.relevance === 'yes');
    else if (filter === 'top') list = list.filter((t) => t.relevance !== 'no');
    return list;
  }, [tweetLeads, filter]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <XLogo /> X signals
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{tweetLeads.length}</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">Tweets showing buying intent, learned from your Relevant / Not calls.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => run(rescoreTweets)} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <Sparkles size={15} /> Re-score
          </button>
          <button onClick={() => run(pollTweetsNow)} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50">
            <RefreshCw size={15} className={pending ? 'animate-spin' : ''} /> Poll now
          </button>
        </div>
      </div>

      {/* Keyword manager */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 p-4">
        <span className="text-xs font-medium text-slate-500">Watching:</span>
        {tweetKeywords.length === 0 && <span className="text-xs text-slate-400">no keywords yet — add one →</span>}
        {tweetKeywords.map((k) => (
          <span key={k.id} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${k.active ? 'border-brand/30 bg-brand-light/40 text-brand-dark' : 'border-slate-200 bg-white text-slate-400'}`}>
            <button onClick={() => run(() => toggleTweetKeyword(k.id, !k.active))} title={k.active ? 'Pause' : 'Resume'} className="max-w-[220px] truncate hover:underline">
              {k.query}
            </button>
            <button onClick={() => run(() => removeTweetKeyword(k.id))} title="Remove" className="text-slate-400 hover:text-rose-600"><XIcon size={12} /></button>
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && kw.trim()) { run(() => addTweetKeyword(kw.trim())); setKw(''); } }}
            placeholder='"need a web designer"'
            className="w-52 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-brand focus:outline-none"
          />
          <button onClick={() => { if (kw.trim()) { run(() => addTweetKeyword(kw.trim())); setKw(''); } }} disabled={pending || !kw.trim()} className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-50"><Plus size={14} /></button>
        </span>
      </div>

      {/* Filters + status */}
      <div className="flex flex-wrap items-center gap-2 p-4 pb-0">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${filter === f ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {f}
          </button>
        ))}
        {msg && <span className="ml-1 text-xs text-slate-500">{msg}</span>}
      </div>

      {/* Tiles */}
      <div className="p-4">
        {!twitterReady && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            TWITTERAPI_IO_KEY isn’t set — add your twitterapi.io key in Railway, then “Poll now”.
          </p>
        )}
        {visible.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            {twitterReady ? 'No tweets yet — add keywords above and hit “Poll now”.' : 'Nothing to show yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((t) => (
              <TweetCard key={t.id} t={t} disabled={pending} run={run} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TweetCard({ t, disabled, run }: { t: TweetLead; disabled: boolean; run: (fn: () => Promise<unknown>, note?: string) => void }) {
  const handle = t.authorHandle ? `@${t.authorHandle}` : 'unknown';
  const replyUrl = `https://x.com/intent/tweet?in_reply_to=${t.tweetId}`;
  const dmUrl = t.authorId ? `https://x.com/messages/compose?recipient_id=${t.authorId}` : t.authorHandle ? `https://x.com/${t.authorHandle}` : t.url;

  return (
    <div className={`flex flex-col rounded-xl border p-3 transition ${t.status === 'contacted' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {t.authorAvatar ? <img src={t.authorAvatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200" />}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-800">{t.authorName ?? handle}</div>
            <div className="truncate text-xs text-slate-400">{handle}{t.postedAt ? ` · ${ago(t.postedAt)}` : ''}</div>
          </div>
        </div>
        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${scoreClass(t.aiScore)}`} title={t.aiReason ?? ''}>
          {t.aiScore ?? '—'}
        </span>
      </div>

      <p className="mt-2 line-clamp-5 whitespace-pre-line text-sm leading-relaxed text-slate-700">{t.text}</p>
      {t.aiReason && <p className="mt-1.5 text-[11px] italic text-slate-400">“{t.aiReason}”</p>}

      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
        {t.matchedQuery && <span className="truncate rounded bg-slate-100 px-1.5 py-0.5">{t.matchedQuery}</span>}
        <span className="inline-flex items-center gap-0.5"><Heart size={11} /> {t.likeCount}</span>
        <span className="inline-flex items-center gap-0.5"><MessageCircle size={11} /> {t.replyCount}</span>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between gap-1 border-t border-slate-100 pt-2">
        <div className="flex items-center gap-1">
          <button onClick={() => run(() => setTweetRelevance(t.id, t.relevance === 'yes' ? 'unknown' : 'yes'))} disabled={disabled} title="Relevant (teaches the model)" className={`grid h-7 w-7 place-items-center rounded-lg border transition disabled:opacity-50 ${t.relevance === 'yes' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400 hover:text-emerald-600'}`}>
            <ThumbsUp size={13} />
          </button>
          <button onClick={() => run(() => setTweetRelevance(t.id, t.relevance === 'no' ? 'unknown' : 'no'))} disabled={disabled} title="Not relevant (teaches the model)" className={`grid h-7 w-7 place-items-center rounded-lg border transition disabled:opacity-50 ${t.relevance === 'no' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-400 hover:text-rose-600'}`}>
            <ThumbsDown size={13} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <a href={dmUrl} target="_blank" rel="noreferrer" title="DM" className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-600"><Mail size={13} /></a>
          <a href={replyUrl} target="_blank" rel="noreferrer" title="Reply" className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-600"><Reply size={13} /></a>
          <a href={t.url} target="_blank" rel="noreferrer" onClick={() => run(() => setTweetStatus(t.id, 'contacted'))} title="Open tweet" className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark">
            Open <ExternalLink size={12} />
          </a>
          <button onClick={() => run(() => setTweetStatus(t.id, 'ignored'))} disabled={disabled} title="Ignore" className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 disabled:opacity-50"><Check size={13} /></button>
        </div>
      </div>
    </div>
  );
}

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" className="text-slate-800" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
