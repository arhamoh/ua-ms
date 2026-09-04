'use server';

import { prisma } from '@/lib/prisma';
import { sendEmail, emailConfigured } from '@/lib/email';
import { createResetToken, resetLink, resetEmailHtml } from '@/lib/reset';

export type ForgotState = { done?: boolean; error?: string };

// Public: request a reset link by email or username. Always reports success (so
// it never reveals whether an account exists).
export async function requestPasswordReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const identifier = (formData.get('identifier') ?? '').toString().trim().toLowerCase();
  if (!identifier) return { error: 'Enter your email or username.' };
  try {
    const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] }, select: { id: true, name: true, email: true } });
    if (user && emailConfigured()) {
      const token = await createResetToken(user.id);
      await sendEmail({ to: user.email, subject: 'Reset your Keel password', html: resetEmailHtml(user.name, resetLink(token)) });
    }
  } catch {
    /* swallow — never reveal details */
  }
  return { done: true };
}
