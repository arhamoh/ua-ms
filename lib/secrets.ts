import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Dashboard-managed integration credentials. Values are stored encrypted in the
 * AppSecret table and hydrated into process.env at runtime, so every existing
 * `process.env.X` read keeps working — env vars remain the fallback when nothing
 * is saved. This lets the whole app be configured from Settings → Integrations,
 * which is what turns it into a product other people can set up themselves.
 *
 * SECURITY: values are never returned to the client — only presence/set status.
 */

// The only env vars settable from the dashboard (DATABASE_URL/AUTH_SECRET stay
// deployment-managed and are intentionally excluded).
export const MANAGED_SECRETS = [
  'OPENROUTER_API_KEY',
  'OPENROUTER_MODEL',
  'OPENROUTER_VISION_MODEL',
  'TWITTERAPI_IO_KEY',
  'TWITTER_QUERIES',
  'APOLLO_API_KEY',
  'WAVE_FULL_ACCESS_TOKEN',
  'WAVE_BUSINESS_ID',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'RESEND_API_KEY',
  'INVOICE_FROM_EMAIL',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_SHARED_DRIVE_ID',
  // Google Calendar + Meet (same service account, via domain-wide delegation).
  'GOOGLE_CALENDAR_IMPERSONATE_EMAIL',
  'GOOGLE_CALENDAR_ID',
  'GOOGLE_CALENDAR_TZ',
  'CRON_SECRET',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
] as const;
export type ManagedSecret = (typeof MANAGED_SECRETS)[number];

const MANAGED_SET = new Set<string>(MANAGED_SECRETS);
export const isManagedSecret = (name: string): name is ManagedSecret => MANAGED_SET.has(name);

// ── Encryption (AES-256-GCM) ────────────────────────────────────────────────
function encKey(): Buffer {
  const base = process.env.SECRETS_KEY || process.env.AUTH_SECRET || 'keel-dev-fallback-secret';
  return createHash('sha256').update(base).digest(); // 32 bytes
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

function decrypt(blob: string): string | null {
  try {
    const [v, ivB, tagB, ctB] = blob.split(':');
    if (v !== 'v1') return null;
    const decipher = createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivB, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ── Env hydration ───────────────────────────────────────────────────────────
// Snapshot the real deployment env once so a cleared secret falls back to it
// instead of being lost from the process until restart.
let originalEnv: Record<string, string | undefined> | null = null;
function snapshotOriginal() {
  if (originalEnv) return;
  originalEnv = {};
  for (const n of MANAGED_SECRETS) originalEnv[n] = process.env[n];
}

let lastHydrate = 0;
const HYDRATE_TTL_MS = 15_000;

/**
 * Load saved secrets into process.env (DB value wins over the deployment env).
 * TTL-cached so it's cheap to call from hot paths; never throws.
 */
export async function hydrateSecrets(force = false): Promise<void> {
  if (!force && Date.now() - lastHydrate < HYDRATE_TTL_MS) return;
  try {
    snapshotOriginal();
    const rows = await prisma.appSecret.findMany();
    const saved = new Map(rows.map((r) => [r.name, decrypt(r.value)]));
    for (const n of MANAGED_SECRETS) {
      const v = saved.get(n);
      if (v != null) process.env[n] = v;
      else if (originalEnv![n] != null) process.env[n] = originalEnv![n];
      else delete process.env[n];
    }
    lastHydrate = Date.now();
  } catch {
    /* DB not ready — keep whatever env we have */
  }
}

/** Names that currently have a saved (dashboard) value. */
export async function getSavedSecretNames(): Promise<Set<string>> {
  try {
    const rows = await prisma.appSecret.findMany({ select: { name: true } });
    return new Set(rows.map((r) => r.name));
  } catch {
    return new Set();
  }
}

/** Effective value: saved (decrypted) if present, else the deployment env. */
export async function getSecret(name: string): Promise<string> {
  await hydrateSecrets();
  return process.env[name] ?? '';
}

/** Save/replace a dashboard secret (validated against the allowlist). Encrypts at rest. */
export async function setSecret(name: string, value: string): Promise<void> {
  if (!isManagedSecret(name)) throw new Error(`"${name}" is not a settable integration key.`);
  const v = (value ?? '').trim();
  if (!v) return clearSecret(name);
  snapshotOriginal();
  const enc = encrypt(v);
  await prisma.appSecret.upsert({ where: { name }, update: { value: enc }, create: { name, value: enc } });
  process.env[name] = v; // take effect immediately in this process
  lastHydrate = 0; // force other reads to re-hydrate
}

/** Remove a dashboard secret; the value falls back to the deployment env (if any). */
export async function clearSecret(name: string): Promise<void> {
  if (!isManagedSecret(name)) return;
  snapshotOriginal();
  await prisma.appSecret.deleteMany({ where: { name } });
  const orig = originalEnv![name];
  if (orig != null) process.env[name] = orig;
  else delete process.env[name];
  lastHydrate = 0;
}
