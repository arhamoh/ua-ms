import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { twitterApiConfigured } from '@/lib/leadgen/xpipeline';
import XSignals from '../XSignals';

export const dynamic = 'force-dynamic';

export default async function XLeadsPage() {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN')) redirect('/');

  const [tweetRaw, keywordRaw, lastTweet] = await Promise.all([
    prisma.tweetLead.findMany({
      where: { status: { not: 'ignored' }, postedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      orderBy: [{ aiScore: { sort: 'desc', nulls: 'last' } }, { postedAt: 'desc' }, { createdAt: 'desc' }],
      take: 120,
    }),
    prisma.tweetKeyword.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.tweetLead.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ]);

  const tweetLeads = tweetRaw.map((t) => ({
    id: t.id,
    tweetId: t.tweetId,
    url: t.url,
    text: t.text,
    authorHandle: t.authorHandle,
    authorName: t.authorName,
    authorAvatar: t.authorAvatar,
    authorId: t.authorId,
    likeCount: t.likeCount,
    replyCount: t.replyCount,
    postedAt: t.postedAt ? t.postedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    matchedQuery: t.matchedQuery,
    relevance: t.relevance,
    aiScore: t.aiScore,
    aiReason: t.aiReason,
    draft: t.draft,
    status: t.status,
  }));
  const tweetKeywords = keywordRaw.map((k) => ({ id: k.id, query: k.query, active: k.active }));

  return <XSignals tweetLeads={tweetLeads} tweetKeywords={tweetKeywords} twitterReady={twitterApiConfigured()} lastUpdated={lastTweet?.createdAt.toISOString() ?? null} />;
}
