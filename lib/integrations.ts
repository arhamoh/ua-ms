// Integration / env-var status for the Settings page. Reports whether each
// integration's keys are present and lets the UI live-test the connection.
// SECURITY: never expose secret values — only presence (set / not set).

import { prisma } from '@/lib/prisma';
import { hydrateSecrets, getSavedSecretNames, isManagedSecret } from '@/lib/secrets';

const isSet = (v?: string | null) => Boolean(v && v.trim());

export type EnvVarStatus = { name: string; set: boolean; required?: boolean; saved?: boolean; editable?: boolean };
export type IntegrationStatus = {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'warn' | 'off';
  summary: string;
  vars: EnvVarStatus[];
  testable: boolean;
  group: string;
};

export async function getIntegrations(): Promise<IntegrationStatus[]> {
  await hydrateSecrets(); // reflect dashboard-saved keys in the statuses below
  const e = process.env;
  const savedNames = await getSavedSecretNames();

  // Live DB ping — the one integration we can verify on load cheaply.
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const authSet = isSet(e.AUTH_SECRET);
  const orSet = isSet(e.OPENROUTER_API_KEY);
  const waveSet = isSet(e.WAVE_FULL_ACCESS_TOKEN);
  const xSet = isSet(e.TWITTERAPI_IO_KEY);
  const apolloSet = isSet(e.APOLLO_API_KEY);
  const googleClient = isSet(e.GOOGLE_OAUTH_CLIENT_ID) && isSet(e.GOOGLE_OAUTH_CLIENT_SECRET);
  const googleLinked = isSet(e.GOOGLE_REFRESH_TOKEN) && isSet(e.GOOGLE_CONNECTED_EMAIL);

  // Grouped so similar integrations sit together in the UI. The "Google" group
  // is rendered as a single combined card in IntegrationsPanel.
  const list: IntegrationStatus[] = [
    // ── Google (one connection powers Gmail, Calendar, Meet & Drive) ─────────
    {
      id: 'google',
      group: 'Google',
      name: 'Google Workspace — one connection',
      description: 'Connect once with Google to power email (Gmail), Calendar, Meet, and Drive file uploads.',
      status: googleLinked ? 'connected' : googleClient ? 'warn' : 'off',
      summary: googleLinked
        ? `Connected as ${e.GOOGLE_CONNECTED_EMAIL} — powering Gmail, Calendar, Meet & Drive.`
        : googleClient
          ? 'Client keys set — click “Connect Google” below to finish.'
          : 'Add your Google OAuth client ID & secret, then connect your account.',
      vars: [
        { name: 'GOOGLE_OAUTH_CLIENT_ID', set: isSet(e.GOOGLE_OAUTH_CLIENT_ID), required: true },
        { name: 'GOOGLE_OAUTH_CLIENT_SECRET', set: isSet(e.GOOGLE_OAUTH_CLIENT_SECRET), required: true },
      ],
      testable: googleLinked,
    },
    // ── AI ─────────────────────────────────────────────────────────────────
    {
      id: 'openrouter',
      group: 'AI',
      name: 'AI (OpenRouter)',
      description: 'Powers the assistant chatbot, bill-photo OCR, and PDF statement import.',
      status: orSet ? 'connected' : 'off',
      summary: orSet ? 'Key present — run a test to confirm.' : 'Not configured — AI features are disabled.',
      vars: [
        { name: 'OPENROUTER_API_KEY', set: orSet, required: true },
        { name: 'OPENROUTER_MODEL', set: isSet(e.OPENROUTER_MODEL) },
        { name: 'OPENROUTER_VISION_MODEL', set: isSet(e.OPENROUTER_VISION_MODEL) },
      ],
      testable: orSet,
    },
    // ── Leads ──────────────────────────────────────────────────────────────
    {
      id: 'apollo',
      group: 'Leads',
      name: 'Apollo (lead search)',
      description: 'Sources B2B leads by title, industry and location on the Leads → Apollo page.',
      status: apolloSet ? 'connected' : 'off',
      summary: apolloSet
        ? 'Key present — search for leads on the Leads → Apollo page.'
        : 'Not configured — add your Apollo API key to search for leads.',
      vars: [{ name: 'APOLLO_API_KEY', set: apolloSet, required: true }],
      testable: false,
    },
    {
      id: 'x',
      group: 'Leads',
      name: 'X / Twitter listener',
      description: 'Finds buying-intent tweets as leads via twitterapi.io (no X login needed).',
      status: xSet ? 'connected' : 'off',
      summary: xSet
        ? 'Key present — manage keywords and poll on the Leads → X page.'
        : 'Not configured — add your twitterapi.io API key to start listening.',
      vars: [{ name: 'TWITTERAPI_IO_KEY', set: xSet, required: true }],
      testable: xSet,
    },
    // ── Accounting ─────────────────────────────────────────────────────────
    {
      id: 'wave',
      group: 'Accounting',
      name: 'Wave Accounting',
      description: 'Import invoices from Wave and match them to clients & payments.',
      status: waveSet ? 'connected' : 'off',
      summary: waveSet
        ? 'Token present — run a test to confirm (requires Wave Pro).'
        : 'Not configured — set WAVE_FULL_ACCESS_TOKEN (requires a Wave Pro plan).',
      vars: [
        { name: 'WAVE_FULL_ACCESS_TOKEN', set: waveSet, required: true },
        { name: 'WAVE_BUSINESS_ID', set: isSet(e.WAVE_BUSINESS_ID) },
      ],
      testable: waveSet,
    },
    // ── Automation ─────────────────────────────────────────────────────────
    {
      id: 'automation',
      group: 'Automation',
      name: 'Automation (scheduled polling)',
      description: 'Lets a scheduler run lead polling + outreach on a timer. Point Railway Cron (or cron-job.org) at /api/leads/cron?task=all with header "Authorization: Bearer <CRON_SECRET>".',
      status: isSet(e.CRON_SECRET) ? 'connected' : 'off',
      summary: isSet(e.CRON_SECRET)
        ? 'Secret set — add a cron schedule in Railway hitting /api/leads/cron.'
        : 'Set a CRON_SECRET, then schedule /api/leads/cron in Railway to poll automatically.',
      vars: [{ name: 'CRON_SECRET', set: isSet(e.CRON_SECRET) }],
      testable: false,
    },
    // ── System (deployment-managed) ────────────────────────────────────────
    {
      id: 'database',
      group: 'System',
      name: 'Database (Postgres)',
      description: 'Core data store — managed by Railway.',
      status: dbOk ? 'connected' : 'off',
      summary: dbOk ? 'Connected — test query succeeded.' : 'Cannot reach the database.',
      vars: [{ name: 'DATABASE_URL', set: isSet(e.DATABASE_URL), required: true }],
      testable: false,
    },
    {
      id: 'auth',
      group: 'System',
      name: 'Authentication',
      description: 'Secret used to sign login sessions.',
      status: authSet ? 'connected' : 'warn',
      summary: authSet
        ? 'Custom secret set.'
        : 'Using an insecure dev fallback — set AUTH_SECRET in Railway.',
      vars: [{ name: 'AUTH_SECRET', set: authSet, required: true }],
      testable: false,
    },
  ];

  // Tag each var: `editable` = settable from this dashboard; `saved` = a value is
  // currently stored here (vs. only coming from the deployment env).
  return list.map((it) => ({
    ...it,
    vars: it.vars.map((v) => ({ ...v, editable: isManagedSecret(v.name), saved: savedNames.has(v.name) })),
  }));
}

// Live check the OpenRouter key (cheap auth/key endpoint, reports remaining credit).
export async function testOpenRouter(): Promise<{ ok: boolean; message: string }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, message: 'No API key set.' };
  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return { ok: false, message: `OpenRouter responded ${res.status}.` };
    const data: any = await res.json().catch(() => null);
    const limit = data?.data?.limit;
    const usage = data?.data?.usage;
    const credit = limit != null ? ` — $${Math.max(0, limit - (usage ?? 0)).toFixed(2)} credit left` : '';
    return { ok: true, message: `API key valid${credit}.` };
  } catch (err: any) {
    return { ok: false, message: err?.message?.slice(0, 200) ?? 'Connection failed.' };
  }
}
