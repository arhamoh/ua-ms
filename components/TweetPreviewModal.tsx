'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Reply, Loader2 } from 'lucide-react';

// Loads X's embed widget once; renders the real (read-only) tweet inline so you
// can read full context without leaving Keel. Replies still open X (X blocks
// interactive embedding).
let twPromise: Promise<any> | null = null;
function loadWidgets(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const w = window as any;
  if (w.twttr?.widgets) return Promise.resolve(w.twttr);
  if (!twPromise) {
    twPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://platform.twitter.com/widgets.js';
      s.async = true;
      s.onload = () => resolve((window as any).twttr);
      s.onerror = () => resolve(null);
      document.body.appendChild(s);
    });
  }
  return twPromise;
}

type Tweet = { tweetId: string; url: string; text: string; authorHandle: string | null; authorName: string | null };

export default function TweetPreviewModal({
  open,
  onClose,
  tweet,
  replyUrl,
}: {
  open: boolean;
  onClose: () => void;
  tweet: Tweet;
  replyUrl: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    (async () => {
      const tw = await loadWidgets();
      if (cancelled || !holder.current) return;
      holder.current.innerHTML = '';
      if (!tw?.widgets?.createTweet) { setFailed(true); setLoading(false); return; }
      try {
        const el = await tw.widgets.createTweet(tweet.tweetId, holder.current, { align: 'center', dnt: true, conversation: 'none' });
        if (cancelled) return;
        if (!el) setFailed(true);
        setLoading(false);
      } catch {
        if (!cancelled) { setFailed(true); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [open, tweet.tweetId]);

  if (!open) return null;
  const handle = tweet.authorHandle ? `@${tweet.authorHandle}` : '';

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8" onClick={onClose}>
      <div className="my-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="min-w-0 truncate text-sm font-medium text-slate-700">{tweet.authorName ?? handle} <span className="text-slate-400">{handle}</span></div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600"><X size={16} /></button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-4 py-3">
          {loading && <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading tweet…</div>}
          <div ref={holder} className={loading ? 'hidden' : ''} />
          {failed && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{tweet.text}</p>
              <p className="mt-2 text-xs text-slate-400">Couldn’t embed this tweet — open it on X for the full thread.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <a href={replyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Reply size={15} /> Reply on X
          </a>
          <a href={tweet.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            Open on X <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}
