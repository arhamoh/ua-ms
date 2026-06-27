import { NextResponse } from 'next/server';
import { segments } from '@/lib/leadgen/icp';
import { sourceSegment, scoreAll, hasApolloKey } from '@/lib/leadgen/pipeline';
import { seedSequences, enrollSegment, runDue } from '@/lib/leadgen/outreach/engine';

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
 *   GET /api/leads/cron?task=outreach   — send/queue due touches (daily)
 *   GET /api/leads/cron?task=all        — both (default)
 */
export async function GET(req: Request) {
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

  if (task === 'outreach' || task === 'all') {
    out.outreach = await runDue();
  }

  return NextResponse.json({ ok: true, ...out }, { headers: { 'Cache-Control': 'no-store' } });
}
