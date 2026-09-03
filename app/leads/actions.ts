'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { segments, getSegment } from '@/lib/leadgen/icp';
import { sourceUsing, scoreAll, hasApolloKey } from '@/lib/leadgen/pipeline';
import { seedSequences, enrollSegment, runDue } from '@/lib/leadgen/outreach/engine';
import { convertLeadToClient } from '@/lib/leadgen/convert';
import { reclassifyAllTweets, twitterApiConfigured } from '@/lib/leadgen/xpipeline';
import { startPollJob, getPollStatus } from '@/lib/leadgen/pollJob';
import { draftReply } from '@/lib/leadgen/tweetClassify';

async function requireUser() {
  const user = await getSession();
  if (!user || !user.roles.includes('SUPER_ADMIN')) throw new Error('Unauthorized');
  return user;
}

const TERMINAL = ['replied', 'won', 'lost', 'unqualified'];

export interface SearchInput {
  segment: string;
  titles: string[];
  industries: string[];
  locations: string[];
  employeeMin?: number;
  employeeMax?: number;
  limit?: number;
}

/** Live Apollo search with the given filters, then score + revalidate. */
export async function searchLeads(input: SearchInput) {
  await requireUser();
  if (!hasApolloKey()) {
    return { ok: false as const, error: 'APOLLO_API_KEY is not configured on the server.' };
  }
  const base = getSegment(input.segment) ?? segments[0];
  const seg = {
    ...base,
    targetTitles: input.titles.length ? input.titles : base.targetTitles,
    industries: Array.isArray(input.industries) ? input.industries : base.industries,
    locations: Array.isArray(input.locations) ? input.locations : base.locations,
    employeeRange: {
      min: Number.isFinite(input.employeeMin) ? Number(input.employeeMin) : base.employeeRange.min,
      max: Number.isFinite(input.employeeMax) ? Number(input.employeeMax) : base.employeeRange.max,
    },
  };
  const limit = Math.min(Math.max(Number(input.limit ?? 10), 1), 50);
  const { created, skipped } = await sourceUsing(seg, limit);
  await scoreAll();
  revalidatePath('/leads');
  return { ok: true as const, created, skipped, segment: base.key };
}

/** Update a lead's status; terminal states stop any active sequences. */
export async function setLeadStatus(leadId: string, status: string) {
  await requireUser();
  const allowed = ['new', 'scored', 'queued', 'contacted', 'replied', 'won', 'lost', 'unqualified'];
  if (!allowed.includes(status)) return { ok: false as const, error: 'bad status' };
  await prisma.lead.update({ where: { id: leadId }, data: { status } });
  if (TERMINAL.includes(status)) {
    await prisma.sequenceEnrollment.updateMany({
      where: { leadId, status: 'active' },
      data: { status: 'stopped', nextActionAt: null },
    });
  }
  await prisma.leadActivity.create({
    data: { leadId, type: status === 'replied' ? 'replied' : 'note', detail: `status -> ${status}` },
  });
  revalidatePath('/leads');
  return { ok: true as const };
}

/** Convert a won lead into a Client; returns the new client id. */
export async function convertLead(leadId: string) {
  await requireUser();
  const client = await convertLeadToClient(leadId);
  revalidatePath('/leads');
  revalidatePath('/clients');
  return { ok: true as const, clientId: client?.id };
}

/** Seed sequences (if needed) and enroll every segment's leads. */
export async function setupAndEnroll() {
  await requireUser();
  await seedSequences();
  let enrolled = 0;
  for (const s of segments) enrolled += (await enrollSegment(s.key)).enrolled;
  revalidatePath('/leads');
  return { ok: true as const, enrolled };
}

/** Process all due outreach touches now. */
export async function runOutreachNow() {
  await requireUser();
  const result = await runDue();
  revalidatePath('/leads');
  return { ok: true as const, ...result };
}

// ── X (Twitter) listener ─────────────────────────────────────────────────────

/** Start a background poll and return immediately — it keeps running while you navigate. */
export async function pollTweetsNow() {
  await requireUser();
  if (!twitterApiConfigured()) {
    return { ok: false as const, error: 'TWITTERAPI_IO_KEY is not configured on the server.' };
  }
  const r = startPollJob(Number(process.env.X_POLL_PER_QUERY ?? 40));
  return { ok: true as const, started: r.started, alreadyRunning: r.alreadyRunning };
}

/** Current background-poll status (running / last result), for the UI to poll. */
export async function pollStatus() {
  await requireUser();
  return getPollStatus();
}

/** Re-score every tweet using everything it has learned from your labels. */
export async function rescoreTweets() {
  await requireUser();
  const r = await reclassifyAllTweets();
  revalidatePath('/leads');
  return { ok: true as const, ...r };
}

/** Teach the listener: mark a tweet relevant / not-relevant (feeds future scoring). */
export async function setTweetRelevance(id: string, relevance: 'yes' | 'no' | 'unknown') {
  await requireUser();
  if (!['yes', 'no', 'unknown'].includes(relevance)) return;
  await prisma.tweetLead.update({ where: { id }, data: { relevance } });
  revalidatePath('/leads');
}

/** Delete every fetched tweet lead, so you can re-fetch from a clean slate. */
export async function clearAllTweets() {
  await requireUser();
  const { count } = await prisma.tweetLead.deleteMany({});
  revalidatePath('/leads');
  return { ok: true as const, cleared: count };
}

/** Draft (or re-draft) a reply to this tweet with the AI, storing it on the lead. */
export async function draftTweetReply(id: string) {
  await requireUser();
  const t = await prisma.tweetLead.findUnique({ where: { id }, select: { text: true, authorHandle: true } });
  if (!t) return { ok: false as const, error: 'Tweet not found.' };
  const draft = await draftReply(t.text, t.authorHandle);
  if (!draft) return { ok: false as const, error: 'Could not draft a reply (is OpenRouter configured?).' };
  await prisma.tweetLead.update({ where: { id }, data: { draft } });
  revalidatePath('/leads');
  return { ok: true as const, draft };
}

/** Mark a tweet as contacted (you replied/DM'd) or ignored. */
export async function setTweetStatus(id: string, status: 'new' | 'contacted' | 'ignored') {
  await requireUser();
  if (!['new', 'contacted', 'ignored'].includes(status)) return;
  await prisma.tweetLead.update({ where: { id }, data: { status } });
  revalidatePath('/leads');
}

// A curated pool of pain-phrased queries for a web/dev/branding/SEO/ads agency.
// "Add recommended" tops up 10 new ones at a time from this list.
const RECOMMENDED_QUERIES = [
  '"my website is so slow"',
  '"website looks outdated" -job',
  '"embarrassed by my website"',
  '"hate my website" -job -hiring',
  '"losing sales" (website OR checkout)',
  '"our checkout keeps failing"',
  '"no one buys from my website"',
  '"struggling with shopify" -job -hiring',
  '"shopify store looks bad"',
  '"agency ghosted" OR "developer ghosted"',
  '"fired my web" OR "fired my agency"',
  '"no traffic to my website" -course',
  '"need a web designer" -job -hiring -intern',
  '"looking for a shopify developer" -job',
  '"need a new website" -job -hiring',
  '"my site keeps crashing"',
  '"website not mobile friendly"',
  '"my shopify is a mess"',
  '"redesign my website" -course',
  '"can\'t rank on google" -course',
  '"my website looks cheap"',
  '"need help with my website" -job',
  '"developer disappeared" website',
  '"website is broken" -job',
  '"need a landing page" -job -template',
  '"our website is embarrassing"',
  '"my seo isn\'t working" -course',
  '"need a brand refresh"',
  '"cart abandonment" (help OR fix)',
  '"webflow" ("so confusing" OR "giving up")',
];

/** Add the next batch of recommended queries you don't already have (10 at a time). */
export async function loadRecommendedKeywords() {
  await requireUser();
  const existing = await prisma.tweetKeyword.findMany({ select: { query: true } });
  const have = new Set(existing.map((k) => k.query));
  const toAdd = RECOMMENDED_QUERIES.filter((q) => !have.has(q)).slice(0, 10);
  for (const q of toAdd) await prisma.tweetKeyword.create({ data: { query: q } });
  const remaining = RECOMMENDED_QUERIES.filter((q) => !have.has(q)).length - toAdd.length;
  revalidatePath('/leads');
  return { ok: true as const, added: toAdd.length, remaining };
}

/** Add broader copies of your keywords with the -exclusions dropped, to catch
 *  more hire-intent posts (the scorer still filters the extra noise). */
export async function broadenKeywords() {
  await requireUser();
  const all = await prisma.tweetKeyword.findMany({ select: { query: true } });
  const have = new Set(all.map((k) => k.query));
  let added = 0;
  for (const { query } of all) {
    // Strip `-word` / `-"phrase"` exclusion tokens; collapse extra spaces.
    const broad = query.replace(/(^|\s)-(?:"[^"]*"|\S+)/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (broad && broad !== query && !have.has(broad)) {
      await prisma.tweetKeyword.create({ data: { query: broad } });
      have.add(broad);
      added++;
    }
  }
  revalidatePath('/leads');
  return { ok: true as const, added };
}

/** Add a keyword/query the listener watches. */
export async function addTweetKeyword(query: string) {
  await requireUser();
  const q = (query ?? '').trim().slice(0, 200);
  if (!q) return;
  await prisma.tweetKeyword.upsert({ where: { query: q }, update: { active: true }, create: { query: q } });
  revalidatePath('/leads');
}

/** Enable/disable a watched keyword. */
export async function toggleTweetKeyword(id: string, active: boolean) {
  await requireUser();
  await prisma.tweetKeyword.update({ where: { id }, data: { active } });
  revalidatePath('/leads');
}

/** Delete a watched keyword. */
export async function removeTweetKeyword(id: string) {
  await requireUser();
  await prisma.tweetKeyword.delete({ where: { id } });
  revalidatePath('/leads');
}
