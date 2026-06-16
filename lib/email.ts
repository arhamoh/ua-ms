// Email via Resend. No-ops gracefully until RESEND_API_KEY + INVOICE_FROM_EMAIL are set.

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.INVOICE_FROM_EMAIL);
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
  const key = process.env.RESEND_API_KEY;
  const from = process.env.INVOICE_FROM_EMAIL;
  if (!key || !from) {
    return { ok: false, error: 'Email not configured (set RESEND_API_KEY and INVOICE_FROM_EMAIL).' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: `Email send failed: ${res.status} ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Email send failed' };
  }
}
