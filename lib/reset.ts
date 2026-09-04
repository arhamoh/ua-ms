import 'server-only';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { appBaseUrl } from '@/lib/welcome-email';

const TTL_MS = 60 * 60 * 1000; // 1 hour
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/** Create a one-time reset token for a user and return the raw token. */
export async function createResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TTL_MS) } });
  return token;
}

/** Return the user id for a valid (unused, unexpired) token, else null. */
export async function checkResetToken(token: string): Promise<string | null> {
  if (!token) return null;
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row.userId;
}

export async function markResetUsed(token: string): Promise<void> {
  await prisma.passwordResetToken.updateMany({ where: { tokenHash: hashToken(token) }, data: { usedAt: new Date() } });
}

export function resetLink(token: string): string {
  return `${appBaseUrl()}/reset-password?token=${token}`;
}

function shell(body: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f1f5f9;padding:24px 0;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <div style="background:#0f5132;padding:18px 24px;"><span style="color:#fff;font-size:20px;font-weight:700;">keel.</span></div>
      <div style="padding:24px;color:#334155;font-size:14px;line-height:1.6;">${body}</div>
    </div></div>`;
}

export function resetEmailHtml(name: string, link: string): string {
  return shell(
    `<p>Hi ${name || 'there'},</p>
     <p>Use the button below to set a new password for your Keel account. This link expires in 1 hour.</p>
     <p style="margin:16px 0;"><a href="${link}" style="display:inline-block;background:#0f5132;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;">Reset your password</a></p>
     <p style="color:#94a3b8;font-size:12px;">If you didn't request this, you can ignore this email.</p>`,
  );
}
