// Integration / env-var status for the Settings page. Reports whether each
// integration's keys are present and lets the UI live-test the connection.
// SECURITY: never expose secret values — only presence (set / not set).

import { prisma } from '@/lib/prisma';
import { driveConfigured } from '@/lib/drive';
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

  const smtp = isSet(e.SMTP_HOST) && isSet(e.SMTP_USER) && isSet(e.SMTP_PASS);
  const resend = isSet(e.RESEND_API_KEY) && isSet(e.INVOICE_FROM_EMAIL);
  const authSet = isSet(e.AUTH_SECRET);
  const orSet = isSet(e.OPENROUTER_API_KEY);
  const waveSet = isSet(e.WAVE_FULL_ACCESS_TOKEN);
  const xSet = isSet(e.TWITTERAPI_IO_KEY);
  const drive = driveConfigured();

  const list: IntegrationStatus[] = [
    {
      id: 'database',
      name: 'Database (Postgres)',
      description: 'Core data store — managed by Railway.',
      status: dbOk ? 'connected' : 'off',
      summary: dbOk ? 'Connected — test query succeeded.' : 'Cannot reach the database.',
      vars: [{ name: 'DATABASE_URL', set: isSet(e.DATABASE_URL), required: true }],
      testable: false,
    },
    {
      id: 'auth',
      name: 'Authentication',
      description: 'Secret used to sign login sessions.',
      status: authSet ? 'connected' : 'warn',
      summary: authSet
        ? 'Custom secret set.'
        : 'Using an insecure dev fallback — set AUTH_SECRET in Railway.',
      vars: [{ name: 'AUTH_SECRET', set: authSet, required: true }],
      testable: false,
    },
    {
      id: 'drive',
      name: 'Google Drive (file uploads)',
      description: 'Stores uploaded project files in your Shared Drive.',
      status: drive ? 'connected' : 'off',
      summary: drive ? 'Keys present — run a test to confirm access.' : 'Not configured — file uploads are disabled.',
      vars: [
        { name: 'GOOGLE_SERVICE_ACCOUNT_JSON', set: isSet(e.GOOGLE_SERVICE_ACCOUNT_JSON), required: true },
        { name: 'GOOGLE_SHARED_DRIVE_ID', set: isSet(e.GOOGLE_SHARED_DRIVE_ID), required: true },
      ],
      testable: drive,
    },
    {
      id: 'email',
      name: 'Email (invoices & receipts)',
      description: 'Sends invoice/receipt emails via Gmail/SMTP or Resend.',
      status: smtp || resend ? 'connected' : 'off',
      summary: smtp
        ? 'Using Gmail/SMTP.'
        : resend
          ? 'Using Resend.'
          : 'Not configured — sending emails is disabled.',
      vars: [
        { name: 'SMTP_HOST', set: isSet(e.SMTP_HOST) },
        { name: 'SMTP_USER', set: isSet(e.SMTP_USER) },
        { name: 'SMTP_PASS', set: isSet(e.SMTP_PASS) },
        { name: 'SMTP_FROM', set: isSet(e.SMTP_FROM) },
        { name: 'RESEND_API_KEY', set: isSet(e.RESEND_API_KEY) },
        { name: 'INVOICE_FROM_EMAIL', set: isSet(e.INVOICE_FROM_EMAIL) },
      ],
      testable: smtp || resend,
    },
    {
      id: 'openrouter',
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
    {
      id: 'wave',
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
    {
      id: 'x',
      name: 'X / Twitter listener',
      description: 'Finds buying-intent tweets as leads via twitterapi.io (no X login needed).',
      status: xSet ? 'connected' : 'off',
      summary: xSet
        ? 'Key present — manage keywords and poll on the Leads → X page.'
        : 'Not configured — add your twitterapi.io API key to start listening.',
      vars: [{ name: 'TWITTERAPI_IO_KEY', set: xSet, required: true }],
      testable: xSet,
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
