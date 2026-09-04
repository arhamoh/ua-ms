// Email sending. Prefers the connected Google account (Gmail API); falls back to
// Resend when Google isn't connected.

import { googleConnected, googleConnectedEmail, getAccessToken } from '@/lib/google';

function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.INVOICE_FROM_EMAIL);
}

export function emailConfigured() {
  return googleConnected() || resendConfigured();
}

export interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded
  contentType?: string;
}

// ── Verify (Settings integrations panel) ─────────────────────────────────────
export async function verifyEmailConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    if (googleConnected()) {
      const token = await getAccessToken();
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok
        ? { ok: true, message: `Gmail ready (${googleConnectedEmail()}).` }
        : { ok: false, message: `Gmail responded ${res.status}.` };
    }
    if (resendConfigured()) {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      return res.ok ? { ok: true, message: 'Resend API key accepted.' } : { ok: false, message: `Resend responded ${res.status}.` };
    }
    return { ok: false, message: 'Not configured.' };
  } catch (err: any) {
    return { ok: false, message: err?.message?.slice(0, 200) ?? 'Connection failed.' };
  }
}

// ── Gmail ────────────────────────────────────────────────────────────────────
function b64url(s: string): string {
  return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildRawEmail(from: string, to: string, subject: string, html: string, attachments?: EmailAttachment[]): string {
  const enc = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
  if (!attachments?.length) {
    const msg =
      [`From: ${from}`, `To: ${to}`, `Subject: ${enc}`, 'MIME-Version: 1.0', 'Content-Type: text/html; charset="UTF-8"', ''].join('\r\n') +
      '\r\n' + html;
    return b64url(msg);
  }
  const boundary = `keel_${Math.random().toString(36).slice(2)}`;
  const parts = [
    [`From: ${from}`, `To: ${to}`, `Subject: ${enc}`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '', ''].join('\r\n'),
    `--${boundary}\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${html}\r\n`,
    ...attachments.map(
      (a) =>
        `--${boundary}\r\nContent-Type: ${a.contentType ?? 'application/octet-stream'}; name="${a.filename}"\r\n` +
        `Content-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${a.filename}"\r\n\r\n${a.content}\r\n`,
    ),
    `--${boundary}--`,
  ];
  return b64url(parts.join(''));
}

async function sendViaGmail(to: string, subject: string, html: string, attachments?: EmailAttachment[]) {
  const token = await getAccessToken();
  const from = process.env.INVOICE_FROM_EMAIL || googleConnectedEmail() || 'me';
  const raw = buildRawEmail(from, to, subject, html, attachments);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${(await res.text()).slice(0, 160)}`);
}

// ── Resend (fallback) ────────────────────────────────────────────────────────
async function sendViaResend(to: string, subject: string, html: string, attachments?: EmailAttachment[]) {
  const body: Record<string, unknown> = { from: process.env.INVOICE_FROM_EMAIL, to, subject, html };
  if (attachments?.length) body.attachments = attachments.map((a) => ({ filename: a.filename, content: a.content }));
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 160)}`);
}

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: boolean; error?: string }> {
  try {
    if (googleConnected()) {
      await sendViaGmail(to, subject, html, attachments);
      return { ok: true };
    }
    if (resendConfigured()) {
      await sendViaResend(to, subject, html, attachments);
      return { ok: true };
    }
    return { ok: false, error: 'Email not configured (connect Google, or set RESEND_API_KEY + INVOICE_FROM_EMAIL).' };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Email send failed' };
  }
}
