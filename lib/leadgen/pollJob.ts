import 'server-only';
import { pollTweetLeads, classifyPendingTweets, notifyNewQualifiedLeads } from './xpipeline';
import { hydrateSecrets } from '@/lib/secrets';

// Runs a poll in the background so the UI can return immediately and the user can
// navigate away while it works. Railway runs a single persistent Node process, so
// a detached promise keeps running after the action responds; status lives on
// globalThis so it survives module reloads and is shared across requests.

export type PollResult = { created: number; skipped: number; queries: number; scored: number; notified: number };
export type PollStatus = {
  running: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  result: PollResult | null;
  error: string | null;
};

const g = globalThis as unknown as { __keelPollStatus?: PollStatus };
if (!g.__keelPollStatus) {
  g.__keelPollStatus = { running: false, startedAt: null, finishedAt: null, result: null, error: null };
}
const status = g.__keelPollStatus;

export function getPollStatus(): PollStatus {
  return { ...status };
}

/** Start a background poll. Returns immediately; no-op if one is already running. */
export function startPollJob(perQuery = 20): { started: boolean; alreadyRunning: boolean } {
  // A job that's been "running" for over 5 min is stale (crash/hang) — let a new one start.
  const stale = status.running && status.startedAt != null && Date.now() - status.startedAt > 5 * 60 * 1000;
  if (status.running && !stale) return { started: false, alreadyRunning: true };
  status.running = true;
  status.startedAt = Date.now();
  status.finishedAt = null;
  status.error = null;
  status.result = null;

  void (async () => {
    try {
      await hydrateSecrets(); // ensure keys are loaded outside a request context
      const poll = await pollTweetLeads(perQuery);
      const cls = await classifyPendingTweets();
      const alert = await notifyNewQualifiedLeads();
      status.result = { ...poll, scored: cls.scored, notified: alert.notified };
    } catch (e) {
      status.error = ((e as Error)?.message ?? 'Poll failed.').slice(0, 200);
    } finally {
      status.running = false;
      status.finishedAt = Date.now();
    }
  })();

  return { started: true, alreadyRunning: false };
}
