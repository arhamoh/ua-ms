// Email sending via Resend.

function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.INVOICE_FROM_EMAIL);
}

export function emailConfigured() {
  return resendConfigured();
}

// Live connectivity check for the Settings integrations panel — confirms the
// Resend API key is accepted, without sending an email.
export async function verifyEmailConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    if (!resendConfigured()) return { ok: false, message: 'Not configured.' };
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    return res.ok
      ? { ok: true, message: 'Resend API key accepted.' }
      : { ok: false, message: `Resend responded ${res.status}.` };
  } catch (err: any) {
    return { ok: false, message: err?.message?.slice(0, 200) ?? 'Connection failed.' };
  }
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
    if (!resendConfigured()) {
      return { ok: false, error: 'Email not configured (set RESEND_API_KEY + INVOICE_FROM_EMAIL).' };
    }
    await sendViaResend(to, subject, html);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Email send failed' };
  }
}
