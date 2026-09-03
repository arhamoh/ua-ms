import { prisma } from '@/lib/prisma';
import { searchTweets, twitterApiConfigured } from './sources/xListener';
import { classifyTweets } from './tweetClassify';
import { notifyUsers } from '@/lib/notify';
import { sendPush } from '@/lib/push';

export { twitterApiConfigured };

/**
 * Alert on freshly-found, high-scoring leads: one in-platform notification per
 * lead for every super-admin, plus a phone push. Marks them notified so we never
 * alert twice. Runs after scoring, on both manual polls and the cron.
 */
export async function notifyNewQualifiedLeads(): Promise<{ notified: number }> {
  const minScore = Number(process.env.X_NOTIFY_MIN_SCORE ?? 70);
  const fresh = await prisma.tweetLead.findMany({
    where: { notified: false, relevance: { not: 'no' }, aiScore: { gte: minScore } },
    orderBy: { aiScore: 'desc' },
    take: 20,
  });
  if (fresh.length === 0) return { notified: 0 };

  const admins = await prisma.user.findMany({ where: { roles: { has: 'SUPER_ADMIN' } }, select: { id: true } });
  const adminIds = admins.map((a) => a.id);

  for (const t of fresh) {
    const who = t.authorHandle ? `@${t.authorHandle}` : 'someone';
    const title = `New lead (${t.aiScore}) — ${who}`;
    const body = t.text.replace(/\s+/g, ' ').trim().slice(0, 140);
    await notifyUsers(adminIds, { type: 'x_lead', title, body, href: '/leads/x' });
    await sendPush(adminIds, { title, body, url: '/leads/x' });
  }
  await prisma.tweetLead.updateMany({ where: { id: { in: fresh.map((t) => t.id) } }, data: { notified: true } });
  return { notified: fresh.length };
}

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

// The model returns unreliable JSON when asked to score too many tweets at once
// (it truncates), so classify in small batches and persist each batch.
async function scoreInChunks(rows: { id: string; text: string }[], chunkSize = 15): Promise<number> {
  let scored = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const verdicts = await classifyTweets(chunk);
    for (const [id, v] of verdicts) {
      await prisma.tweetLead.update({ where: { id }, data: { aiScore: v.score, aiReason: v.reason } });
      scored++;
    }
  }
  return scored;
}

/** Score any tweets that don't yet have an AI score, learning from the user's labels. */
export async function classifyPendingTweets(limit = 90): Promise<{ scored: number }> {
  const pending = await prisma.tweetLead.findMany({
    where: { aiScore: null },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, text: true },
  });
  if (pending.length === 0) return { scored: 0 };
  return { scored: await scoreInChunks(pending) };
}

/** Re-score every tweet against the current labels (used after the user teaches it more). */
export async function reclassifyAllTweets(limit = 200): Promise<{ scored: number }> {
  const rows = await prisma.tweetLead.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, text: true },
  });
  return { scored: await scoreInChunks(rows) };
}
