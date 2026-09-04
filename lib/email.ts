// Email sending via the connected Google account (Gmail API).

import { googleConnected, googleConnectedEmail, getAccessToken } from '@/lib/google';

export function emailConfigured() {
  return googleConnected();
}

export interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded
  contentType?: string;
}

export async function verifyEmailConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    if (!googleConnected()) return { ok: false, message: 'Connect Google to send email.' };
    const token = await getAccessToken();
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok
      ? { ok: true, message: `Gmail ready (${googleConnectedEmail()}).` }
      : { ok: false, message: `Gmail responded ${res.status}.` };
  } catch (err: any) {
    return { ok: false, message: err?.message?.slice(0, 200) ?? 'Connection failed.' };
  }
}

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
    if (!googleConnected()) return { ok: false, error: 'Email not configured — connect Google.' };
    const token = await getAccessToken();
    const from = process.env.INVOICE_FROM_EMAIL || googleConnectedEmail() || 'me';
    const raw = buildRawEmail(from, to, subject, html, attachments);
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) throw new Error(`Gmail ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Email send failed' };
  }
}
