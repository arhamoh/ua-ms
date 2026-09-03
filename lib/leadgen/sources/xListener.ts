/**
 * X (Twitter) listener source — pulls buying-intent tweets through twitterapi.io,
 * a third-party X data API. No X login/developer account required: you sign up on
 * twitterapi.io, get an API key, and this reads through their servers. Pay-per-use
 * (~$0.15 / 1k tweets) with a free trial credit, so it costs pennies at our volume.
 *
 * Docs: https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search
 * The response shape varies slightly across their versions, so every field is
 * read defensively with fallbacks.
 */

const BASE = 'https://api.twitterapi.io';

export function twitterApiConfigured(): boolean {
  return !!process.env.TWITTERAPI_IO_KEY?.trim();
}

/** Live check the twitterapi.io key with a tiny query (a 200 means the key works). */
export async function testTwitterApi(): Promise<{ ok: boolean; message: string }> {
  if (!twitterApiConfigured()) return { ok: false, message: 'No twitterapi.io API key set.' };
  try {
    const hits = await searchTweets('web design', 1, 1);
    return { ok: true, message: `Connected — a sample search returned ${hits.length} tweet(s).` };
  } catch (e: any) {
    return { ok: false, message: (e?.message ?? 'Connection failed.').slice(0, 180) };
  }
}

/** A normalized tweet, provider-agnostic so we can swap X sources later. */
export interface TweetHit {
  tweetId: string;
  url: string;
  text: string;
  lang?: string;
  authorId?: string;
  authorHandle?: string;
  authorName?: string;
  authorAvatar?: string;
  likeCount: number;
  replyCount: number;
  postedAt?: Date;
}

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

function normalize(raw: any): TweetHit | null {
  if (!raw || typeof raw !== 'object') return null;
  const tweetId = str(raw.id) ?? str(raw.id_str) ?? str(raw.tweetId) ?? str(raw.rest_id);
  const text = str(raw.text) ?? str(raw.full_text) ?? str(raw.content) ?? '';
  if (!tweetId || !text) return null;

  const a = raw.author ?? raw.user ?? {};
  const handle = str(a.userName) ?? str(a.screen_name) ?? str(a.username);
  const url =
    str(raw.url) ??
    str(raw.twitterUrl) ??
    (handle ? `https://x.com/${handle}/status/${tweetId}` : `https://x.com/i/web/status/${tweetId}`);

  const created = str(raw.createdAt) ?? str(raw.created_at) ?? str(raw.date);
  const postedAt = created ? new Date(created) : undefined;

  return {
    tweetId,
    url,
    text,
    lang: str(raw.lang),
    authorId: str(a.id) ?? str(a.id_str) ?? str(a.rest_id) ?? str(a.userId),
    authorHandle: handle,
    authorName: str(a.name) ?? str(a.displayName),
    authorAvatar: str(a.profilePicture) ?? str(a.profile_image_url_https) ?? str(a.avatar),
    likeCount: num(raw.likeCount ?? raw.favorite_count ?? raw.favoriteCount),
    replyCount: num(raw.replyCount ?? raw.reply_count),
    postedAt: postedAt && !isNaN(postedAt.getTime()) ? postedAt : undefined,
  };
}

/**
 * Search recent tweets matching an X advanced-search query. Pages until we have
 * `limit` hits or run out (capped to keep cost/latency bounded).
 */
export async function searchTweets(query: string, limit = 20, maxPages = 3, sinceDays = 7): Promise<TweetHit[]> {
  const key = process.env.TWITTERAPI_IO_KEY?.trim();
  if (!key) throw new Error('TWITTERAPI_IO_KEY is not configured.');

  // Constrain to the last N days unless the query already sets its own window,
  // so we only surface fresh, actionable tweets (X `since:` operator).
  let q = query;
  if (!/\bsince:/i.test(q)) {
    const since = new Date(Date.now() - sinceDays * 86400000).toISOString().slice(0, 10);
    q = `${q} since:${since}`;
  }
  // Cut the biggest noise sources: replies (people @-ing each other in threads)
  // and retweets — we want original posts voicing a need.
  if (!/filter:replies/i.test(q)) q = `${q} -filter:replies`;
  if (!/filter:retweets/i.test(q)) q = `${q} -filter:retweets`;

  const hits: TweetHit[] = [];
  let cursor = '';
  for (let page = 0; page < maxPages && hits.length < limit; page++) {
    const params = new URLSearchParams({ query: q, queryType: 'Latest' });
    if (cursor) params.set('cursor', cursor);
    // Per-request timeout so one slow query can't stall the whole fetch.
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 20000);
    let res: Response;
    try {
      res = await fetch(`${BASE}/twitter/tweet/advanced_search?${params.toString()}`, {
        headers: { 'X-API-Key': key, Accept: 'application/json' },
        cache: 'no-store',
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(to);
    }
    if (!res.ok) throw new Error(`twitterapi.io ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data: any = await res.json();
    const rows: any[] = data?.tweets ?? data?.data ?? data?.results ?? [];
    for (const r of rows) {
      const h = normalize(r);
      if (h) hits.push(h);
    }
    const hasNext = data?.has_next_page ?? data?.hasNextPage ?? false;
    cursor = str(data?.next_cursor) ?? str(data?.nextCursor) ?? '';
    if (!hasNext || !cursor || rows.length === 0) break;
  }
  return hits.slice(0, limit);
}
