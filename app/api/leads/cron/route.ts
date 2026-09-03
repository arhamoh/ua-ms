import { NextResponse } from 'next/server';
import { segments } from '@/lib/leadgen/icp';
import { sourceSegment, scoreAll, hasApolloKey } from '@/lib/leadgen/pipeline';
import { seedSequences, enrollSegment, runDue } from '@/lib/leadgen/outreach/engine';
import { pollTweetLeads, classifyPendingTweets, notifyNewQualifiedLeads, twitterApiConfigured } from '@/lib/leadgen/xpipeline';
import { hydrateSecrets } from '@/lib/secrets';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Auth: only a caller that knows CRON_SECRET may trigger jobs.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Scheduled lead-gen jobs. Trigger from Railway Cron or any external scheduler
 * (e.g. cron-job.org) with header `Authorization: Bearer <CRON_SECRET>`:
 *   GET /api/leads/cron?task=source     — source → score → enroll (daily)
 *   GET /api/leads/cron?task=tweets     — poll X keywords → store → score
 *   GET /api/leads/cron?task=outreach   — send/queue due touches (daily)
 *   GET /api/leads/cron?task=all        — all of the above (default)
 */
export async function GET(req: Request) {
  await hydrateSecrets().catch(() => {}); // pick up dashboard-managed keys (this route skips getSession)
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const task = new URL(req.url).searchParams.get('task') ?? 'all';
  const out: Record<string, unknown> = {};

  if (task === 'source' || task === 'all') {
    if (!hasApolloKey()) {
      out.source = { skipped: true, reason: 'No APOLLO_API_KEY — refusing to source mock data.' };
    } else {
      const per = Number(process.env.CRON_SOURCE_LIMIT ?? 5);
      const results: Record<string, { created: number; skipped: number }> = {};
      for (const s of segments) results[s.key] = await sourceSegment(s.key, per);
      await scoreAll();
      await seedSequences();
      for (const s of segments) await enrollSegment(s.key);
      out.source = { perSegment: per, results };
    }
  }

  if (task === 'tweets' || task === 'all') {
    if (!twitterApiConfigured()) {
      out.tweets = { skipped: true, reason: 'No TWITTERAPI_IO_KEY.' };
    } else {
      const per = Number(process.env.X_POLL_PER_QUERY ?? 40);
      const poll = await pollTweetLeads(per);
      const cls = await classifyPendingTweets();
      const alert = await notifyNewQualifiedLeads();
      out.tweets = { ...poll, scored: cls.scored, notified: alert.notified };
    }
  }

  if (task === 'outreach' || task === 'all') {
    out.outreach = await runDue();
  }

  return NextResponse.json({ ok: true, ...out }, { headers: { 'Cache-Control': 'no-store' } });
}
