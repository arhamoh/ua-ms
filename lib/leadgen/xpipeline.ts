import { prisma } from '@/lib/prisma';
import { searchTweets, twitterApiConfigured } from './sources/xListener';
import { classifyTweets } from './tweetClassify';

export { twitterApiConfigured };

/** Active queries: the TweetKeyword table, falling back to the TWITTER_QUERIES env (comma-separated). */
export async function getActiveQueries(): Promise<string[]> {
  const rows = await prisma.tweetKeyword.findMany({ where: { active: true }, select: { query: true } });
  if (rows.length) return rows.map((r) => r.query);
  return (process.env.TWITTER_QUERIES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Poll every active query for new tweets and store them as TweetLeads (deduped by
 * tweetId). Returns counts. Never throws for a single bad query — it's logged and
 * skipped so one failure doesn't abort the whole run.
 */
export async function pollTweetLeads(perQuery = 20): Promise<{ created: number; skipped: number; queries: number }> {
  if (!twitterApiConfigured()) throw new Error('TWITTERAPI_IO_KEY is not configured.');
  const queries = await getActiveQueries();
  let created = 0;
  let skipped = 0;

  for (const q of queries) {
    let hits;
    try {
      hits = await searchTweets(q, perQuery);
    } catch (e) {
      console.warn(`X listener: query "${q}" failed:`, (e as Error).message);
      continue;
    }
    for (const h of hits) {
      const exists = await prisma.tweetLead.findUnique({ where: { tweetId: h.tweetId }, select: { id: true } });
      if (exists) {
        skipped++;
        continue;
      }
      await prisma.tweetLead.create({
        data: {
          tweetId: h.tweetId,
          url: h.url,
          text: h.text,
          lang: h.lang,
          authorId: h.authorId,
          authorHandle: h.authorHandle,
          authorName: h.authorName,
          authorAvatar: h.authorAvatar,
          likeCount: h.likeCount,
          replyCount: h.replyCount,
          postedAt: h.postedAt,
          matchedQuery: q,
        },
      });
      created++;
    }
  }
  return { created, skipped, queries: queries.length };
}

/** Score any tweets that don't yet have an AI score, learning from the user's labels. */
export async function classifyPendingTweets(limit = 40): Promise<{ scored: number }> {
  const pending = await prisma.tweetLead.findMany({
    where: { aiScore: null },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, text: true },
  });
  if (pending.length === 0) return { scored: 0 };

  const verdicts = await classifyTweets(pending);
  let scored = 0;
  for (const [id, v] of verdicts) {
    await prisma.tweetLead.update({ where: { id }, data: { aiScore: v.score, aiReason: v.reason } });
    scored++;
  }
  return { scored };
}

/** Re-score every tweet against the current labels (used after the user teaches it more). */
export async function reclassifyAllTweets(limit = 200): Promise<{ scored: number }> {
  const rows = await prisma.tweetLead.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, text: true },
  });
  const verdicts = await classifyTweets(rows);
  let scored = 0;
  for (const [id, v] of verdicts) {
    await prisma.tweetLead.update({ where: { id }, data: { aiScore: v.score, aiReason: v.reason } });
    scored++;
  }
  return { scored };
}
