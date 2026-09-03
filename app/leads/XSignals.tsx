'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw, Sparkles, ThumbsUp, ThumbsDown, ExternalLink, Reply, Mail, Check, X as XIcon, Plus, Heart, MessageCircle, PenLine, Copy, Loader2, ArrowLeft, Hash, List, Search, Trash2 } from 'lucide-react';
import {
  pollTweetsNow,
  rescoreTweets,
  setTweetRelevance,
  setTweetStatus,
  draftTweetReply,
  addTweetKeyword,
  toggleTweetKeyword,
  removeTweetKeyword,
  loadRecommendedKeywords,
  clearAllTweets,
  pollStatus,
} from './actions';
import { suggestQueries } from '@/app/actions';
import ConfirmModal from '@/components/ConfirmModal';

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
  draft: string | null;
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

const FILTERS = ['top', 'new', 'saved', 'all'] as const;
type Filter = (typeof FILTERS)[number];

export default function XSignals({ tweetLeads, tweetKeywords, twitterReady }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState<Filter>('top');
  const [qFilter, setQFilter] = useState('');
  const [search, setSearch] = useState('');
  const [kw, setKw] = useState('');
  const [tab, setTab] = useState<'signals' | 'keywords'>('signals');
  const [fetching, setFetching] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const activeKw = tweetKeywords.filter((k) => k.active).length;

  // Reflect the background fetch live while on this page: spinner + auto-update.
  useEffect(() => {
    (async () => {
      try { const s = await pollStatus(); if (s.running) setFetching(true); } catch { /* ignore */ }
    })();
    const onFinished = (e: Event) => {
      setFetching(false);
      const s = (e as CustomEvent).detail;
      if (s?.error) setMsg(`⚠️ ${s.error}`);
      else if (s?.result) setMsg(`Fetched ${s.result.created} new tweet(s), scored ${s.result.scored}, ${s.result.notified} alert(s).`);
    };
    window.addEventListener('keel:poll-finished', onFinished);
    return () => window.removeEventListener('keel:poll-finished', onFinished);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI query suggestions from a rough topic.
  const [topic, setTopic] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const getSuggestions = async () => {
    const t = topic.trim();
    if (!t) return;
    setSuggesting(true);
    setSuggestions([]);
    try {
      const r = await suggestQueries(t);
      setSuggestions(r.queries ?? []);
      if (!r.ok && r.message) setMsg(r.message);
    } catch {
      setMsg('Could not get suggestions.');
    } finally {
      setSuggesting(false);
    }
  };

  // Keywords that actually surfaced tweets, with counts — for the filter dropdown.
  const queryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tweetLeads) if (t.matchedQuery) counts.set(t.matchedQuery, (counts.get(t.matchedQuery) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [tweetLeads]);

  const run = (fn: () => Promise<unknown>, note?: string) =>
    start(async () => {
      const r: any = await fn();
      if (note) setMsg(note);
      else if (r && r.ok === false) setMsg(`⚠️ ${r.error}`);
      else if (r && typeof r.created === 'number') setMsg(`Found ${r.created} new tweet(s) across ${r.queries} keyword(s); scored ${r.scored ?? 0}.`);
      else if (r && typeof r.scored === 'number') setMsg(`Re-scored ${r.scored} tweet(s) from what it learned.`);
      else if (r && typeof r.added === 'number') setMsg(`Added ${r.added} keyword(s).${r.remaining ? ` ${r.remaining} more recommended available.` : ''}`);
      else if (r && typeof r.cleared === 'number') setMsg(`Cleared ${r.cleared} tweet(s).`);
      router.refresh();
    });

  // Poll now: starts a background job and returns immediately. A global watcher
  // shows a toast when it finishes, so you can navigate away meanwhile.
  const doPoll = () =>
    start(async () => {
      const r: any = await pollTweetsNow();
      if (r?.ok) {
        setFetching(true);
        window.dispatchEvent(new CustomEvent('keel:poll-started'));
        setMsg('');
      } else if (r?.ok === false) {
        setMsg(`⚠️ ${r.error}`);
      }
    });

  const visible = useMemo(() => {
    let list = tweetLeads;
    if (filter === 'new') list = list.filter((t) => t.status === 'new' && t.relevance !== 'no');
    else if (filter === 'saved') list = list.filter((t) => t.relevance === 'yes');
    else if (filter === 'top') list = list.filter((t) => t.relevance !== 'no');
    if (qFilter) list = list.filter((t) => t.matchedQuery === qFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((t) =>
      t.text.toLowerCase().includes(q) ||
      (t.authorHandle ?? '').toLowerCase().includes(q) ||
      (t.authorName ?? '').toLowerCase().includes(q),
    );
    return list;
  }, [tweetLeads, filter, qFilter, search]);

  return (
    <div className="space-y-6">
      {/* Page header + tabs */}
      <div>
        <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Leads
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900"><XLogo size={22} /> Inbound signals</h1>
            <p className="text-sm text-slate-500">Tweets showing buying intent, learned from your Relevant / Not calls.</p>
          </div>
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <TabBtn active={tab === 'signals'} onClick={() => setTab('signals')} icon={<List size={14} />}>Signals</TabBtn>
            <TabBtn active={tab === 'keywords'} onClick={() => setTab('keywords')} icon={<Hash size={14} />}>Keywords{tweetKeywords.length ? ` · ${tweetKeywords.length}` : ''}</TabBtn>
          </div>
        </div>
      </div>

      {tab === 'signals' && (
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="space-y-3 border-b border-slate-100 p-4">
            {/* Filters + keyword dropdown */}
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${filter === f ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {f}
                </button>
              ))}
              {queryOptions.length > 0 && (
                <select
                  value={qFilter}
                  onChange={(e) => setQFilter(e.target.value)}
                  className="max-w-[60vw] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 focus:border-brand focus:outline-none sm:max-w-xs"
                >
                  <option value="">All keywords ({tweetLeads.length})</option>
                  {queryOptions.map(([q, n]) => (
                    <option key={q} value={q}>{q} ({n})</option>
                  ))}
                </select>
              )}
            </div>
            {/* Search + actions: stack on mobile, spread on wider screens */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tweets…"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-2.5 text-sm focus:border-brand focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmClear(true)}
                  disabled={pending || fetching}
                  title="Clear all fetched tweets"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  <Trash2 size={15} /> <span className="hidden sm:inline">Clear</span>
                </button>
                <button onClick={() => run(rescoreTweets)} disabled={pending || fetching} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex-none">
                  <Sparkles size={15} /> Re-score
                </button>
                <button onClick={doPoll} disabled={pending || fetching} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50 sm:flex-none">
                  <RefreshCw size={15} className={fetching || pending ? 'animate-spin' : ''} /> {fetching ? 'Fetching…' : 'Fetch tweets'}
                </button>
              </div>
            </div>
            {(msg || fetching) && <p className="text-xs text-slate-500">{fetching ? 'Fetching tweets — this can take up to a minute; the list updates when it’s done.' : msg}</p>}
          </div>

          <div className="p-4">
            {!twitterReady && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                TWITTERAPI_IO_KEY isn’t set — add your twitterapi.io key in Settings → Integrations, then “Fetch tweets”.
              </p>
            )}
            {activeKw === 0 && twitterReady && (
              <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                No keywords yet — add some in the <button onClick={() => setTab('keywords')} className="font-medium text-brand hover:underline">Keywords</button> tab, then poll.
              </p>
            )}
            {visible.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">No tweets yet — add keywords in the Keywords tab and hit “Fetch tweets”.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visible.map((t) => (
                  <TweetCard key={t.id} t={t} disabled={pending} run={run} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <ConfirmModal
        open={confirmClear}
        title="Clear all fetched tweets?"
        message="Deletes every fetched tweet so you can re-fetch a fresh batch. Your keywords are untouched."
        confirmLabel="Clear all"
        danger
        pending={pending}
        onConfirm={() => { run(clearAllTweets); setConfirmClear(false); }}
        onCancel={() => setConfirmClear(false)}
      />

      {tab === 'keywords' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700"><Hash size={16} className="text-brand" /> Keywords &amp; queries</h2>
          <p className="mb-4 text-xs text-slate-500">
            Phrases the listener searches on X — you write these yourself, describing what a prospect would tweet. They accept X advanced-search operators
            (quotes for exact phrases, <span className="font-mono">OR</span>, <span className="font-mono">-word</span> to exclude, <span className="font-mono">lang:en</span>, <span className="font-mono">near:Montreal</span>).
            The twitterapi.io key lives in Settings → Integrations.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {tweetKeywords.length === 0 && <span className="text-xs text-slate-400">No keywords yet — add one →</span>}
            {tweetKeywords.map((k) => (
              <span key={k.id} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${k.active ? 'border-brand/30 bg-brand-light/40 text-brand-dark' : 'border-slate-200 bg-white text-slate-400'}`}>
                <button onClick={() => run(() => toggleTweetKeyword(k.id, !k.active))} title={k.active ? 'Pause' : 'Resume'} className="max-w-[240px] truncate hover:underline">
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
                className="w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-brand focus:outline-none"
              />
              <button onClick={() => { if (kw.trim()) { run(() => addTweetKeyword(kw.trim())); setKw(''); } }} disabled={pending || !kw.trim()} className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-50"><Plus size={14} /></button>
            </span>
          </div>

          <div className="mt-4 rounded-lg border border-brand/20 bg-brand-light/30 p-3">
            <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-brand-dark">
              <Sparkles size={12} /> Suggest pain-point queries
            </p>
            <p className="mb-2 text-xs text-slate-500">Type who/what you&apos;re after (e.g. “shopify store owners”, “restaurant websites”) and the AI turns it into frustration-phrased searches you can add.</p>
            <div className="flex items-center gap-1.5">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') getSuggestions(); }}
                placeholder="e.g. shopify store owners losing sales"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand focus:outline-none"
              />
              <button onClick={getSuggestions} disabled={suggesting || !topic.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50">
                {suggesting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Suggest
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.map((q) => (
                  <button key={q} onClick={() => run(() => addTweetKeyword(q))} disabled={pending} className="rounded-full border border-brand/30 bg-white px-2.5 py-1 text-xs text-brand-dark hover:bg-brand-light disabled:opacity-50">
                    + {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => run(loadRecommendedKeywords)}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Plus size={15} /> Add recommended
            </button>
            <span className="text-xs text-slate-400">Adds 10 pain-phrased queries at a time (skips ones you have).</span>
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Examples to start from</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_QUERIES.map((q) => (
                <button key={q} onClick={() => run(() => addTweetKeyword(q))} disabled={pending} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-brand/40 hover:text-brand disabled:opacity-50">
                  + {q}
                </button>
              ))}
            </div>
          </div>
          {msg && <p className="mt-3 text-xs text-slate-500">{msg}</p>}
        </section>
      )}
    </div>
  );
}

// Pain-oriented seeds: people venting a problem convert far better than neutral
// topic mentions. Mix of frustration signals + a few explicit hire intents.
const EXAMPLE_QUERIES = [
  '"my website is so slow"',
  '"website looks outdated"',
  '"embarrassed by my website"',
  '"our checkout keeps failing"',
  '"losing sales" website',
  '"agency ghosted"',
  '"hate my website"',
  '"struggling with shopify"',
  '"can\'t get any traffic"',
  '"need a web designer"',
  '"looking for a web developer"',
  '"redesign my website"',
];

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${active ? 'bg-brand text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      {icon} {children}
    </button>
  );
}

function TweetCard({ t, disabled, run }: { t: TweetLead; disabled: boolean; run: (fn: () => Promise<unknown>, note?: string) => void }) {
  const handle = t.authorHandle ? `@${t.authorHandle}` : 'unknown';
  const dmUrl = t.authorId ? `https://x.com/messages/compose?recipient_id=${t.authorId}` : t.authorHandle ? `https://x.com/${t.authorHandle}` : t.url;

  const [drafting, startDraft] = useTransition();
  const [draft, setDraft] = useState(t.draft ?? '');
  const [open, setOpen] = useState(!!t.draft);
  const [copied, setCopied] = useState(false);

  // Reply link prefilled with the (possibly edited) draft, so X opens ready to send.
  const replyUrl = `https://x.com/intent/tweet?in_reply_to=${t.tweetId}${draft.trim() ? `&text=${encodeURIComponent(draft.trim())}` : ''}`;

  const generate = () =>
    startDraft(async () => {
      const r: any = await draftTweetReply(t.id);
      if (r?.ok) { setDraft(r.draft); setOpen(true); }
    });
  const copy = async () => {
    try { await navigator.clipboard.writeText(draft); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

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

      {/* AI reply draft — edit inline, copy, or open X with it prefilled */}
      {open && (
        <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Your reply…"
            className="w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs leading-relaxed text-slate-700 focus:border-brand focus:outline-none"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <span className={`text-[10px] ${draft.length > 280 ? 'text-rose-500' : 'text-slate-400'}`}>{draft.length}/280</span>
            <div className="flex items-center gap-1">
              <button onClick={generate} disabled={drafting} title="Regenerate" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-1 text-[11px] text-slate-500 hover:text-brand disabled:opacity-50">
                {drafting ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} Redraft
              </button>
              <button onClick={copy} title="Copy" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-1 text-[11px] text-slate-500 hover:text-brand">
                {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between gap-1 border-t border-slate-100 pt-2">
        <div className="flex items-center gap-1">
          <Tip label={t.relevance === 'yes' ? 'Marked relevant — undo' : 'Mark relevant (teaches the AI)'}>
            <button onClick={() => run(() => setTweetRelevance(t.id, t.relevance === 'yes' ? 'unknown' : 'yes'))} disabled={disabled} className={`grid h-7 w-7 place-items-center rounded-lg border transition disabled:opacity-50 ${t.relevance === 'yes' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400 hover:text-emerald-600'}`}>
              <ThumbsUp size={13} />
            </button>
          </Tip>
          <Tip label={t.relevance === 'no' ? 'Marked not relevant — undo' : 'Not relevant (teaches the AI)'}>
            <button onClick={() => run(() => setTweetRelevance(t.id, t.relevance === 'no' ? 'unknown' : 'no'))} disabled={disabled} className={`grid h-7 w-7 place-items-center rounded-lg border transition disabled:opacity-50 ${t.relevance === 'no' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-400 hover:text-rose-600'}`}>
              <ThumbsDown size={13} />
            </button>
          </Tip>
          <Tip label="Draft a reply with AI">
            <button onClick={open ? () => setOpen(false) : generate} disabled={drafting} className={`grid h-7 w-7 place-items-center rounded-lg border transition disabled:opacity-50 ${open ? 'border-brand/40 bg-brand-light text-brand-dark' : 'border-slate-200 text-slate-400 hover:text-brand'}`}>
              {drafting ? <Loader2 size={13} className="animate-spin" /> : <PenLine size={13} />}
            </button>
          </Tip>
        </div>
        <div className="flex items-center gap-1">
          <Tip label="Send a DM on X">
            <a href={dmUrl} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-600"><Mail size={13} /></a>
          </Tip>
          <Tip label={draft.trim() ? 'Reply on X (with your draft)' : 'Reply on X'}>
            <a href={replyUrl} target="_blank" rel="noreferrer" onClick={() => run(() => setTweetStatus(t.id, 'contacted'))} className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-600"><Reply size={13} /></a>
          </Tip>
          <Tip label="Open the tweet on X">
            <a href={t.url} target="_blank" rel="noreferrer" onClick={() => run(() => setTweetStatus(t.id, 'contacted'))} className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark">
              Open <ExternalLink size={12} />
            </a>
          </Tip>
          <Tip label="Ignore / hide this tweet">
            <button onClick={() => run(() => setTweetStatus(t.id, 'ignored'))} disabled={disabled} className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 disabled:opacity-50"><Check size={13} /></button>
          </Tip>
        </div>
      </div>
    </div>
  );
}

// Instant hover tooltip (native title is slow and easy to miss).
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span className="pointer-events-none absolute -top-8 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100">
        {label}
      </span>
    </span>
  );
}

function XLogo({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className="text-slate-800" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
