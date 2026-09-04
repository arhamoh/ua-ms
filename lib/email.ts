// Email sending. Supports SMTP (e.g. Gmail) OR Resend — whichever is configured.
// SMTP takes precedence if SMTP_HOST is set.

import nodemailer from 'nodemailer';

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Gmail via "Sign in with Google" — client keys + a captured refresh token.
function gmailOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GMAIL_OAUTH_REFRESH_TOKEN &&
      process.env.GMAIL_OAUTH_EMAIL,
  );
}

function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.INVOICE_FROM_EMAIL);
}

export function emailConfigured() {
  return gmailOAuthConfigured() || smtpConfigured() || resendConfigured();
}

// A Gmail transport that mints access tokens from the stored refresh token.
function gmailOAuthTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_OAUTH_EMAIL!,
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_OAUTH_REFRESH_TOKEN,
    },
  });
}

async function sendViaGmailOAuth(to: string, subject: string, html: string) {
  const from = process.env.SMTP_FROM || process.env.GMAIL_OAUTH_EMAIL!;
  await gmailOAuthTransport().sendMail({ from, to, subject, html });
}

// Live connectivity check for the Settings integrations panel. Verifies SMTP
// auth, or that the Resend API key is accepted — without sending an email.
export async function verifyEmailConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    if (gmailOAuthConfigured()) {
      await gmailOAuthTransport().verify();
      return { ok: true, message: `Gmail connected as ${process.env.GMAIL_OAUTH_EMAIL}.` };
    }
    if (smtpConfigured()) {
      const port = Number(process.env.SMTP_PORT ?? 465);
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transport.verify();
      return { ok: true, message: `SMTP (${process.env.SMTP_HOST}) authenticated.` };
    }
    if (resendConfigured()) {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      return res.ok
        ? { ok: true, message: 'Resend API key accepted.' }
        : { ok: false, message: `Resend responded ${res.status}.` };
    }
    return { ok: false, message: 'Not configured.' };
  } catch (err: any) {
    return { ok: false, message: err?.message?.slice(0, 200) ?? 'Connection failed.' };
  }
}

async function sendViaSmtp(to: string, subject: string, html: string) {
  const port = Number(process.env.SMTP_PORT ?? 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const from = process.env.SMTP_FROM || process.env.INVOICE_FROM_EMAIL || process.env.SMTP_USER!;
  await transport.sendMail({ from, to, subject, html });
}

async function sendViaResend(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.INVOICE_FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend ${res.status}: ${t.slice(0, 160)}`);
  }
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    if (gmailOAuthConfigured()) {
      await sendViaGmailOAuth(to, subject, html);
      return { ok: true };
    }
    if (smtpConfigured()) {
      await sendViaSmtp(to, subject, html);
      return { ok: true };
    }
    if (resendConfigured()) {
      await sendViaResend(to, subject, html);
      return { ok: true };
    }
    return { ok: false, error: 'Email not configured (connect Gmail, set SMTP_*, or set RESEND_API_KEY + INVOICE_FROM_EMAIL).' };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Email send failed' };
  }
}
