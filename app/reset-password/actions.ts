'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { checkResetToken, markResetUsed } from '@/lib/reset';

export type ResetState = { error?: string };

export async function completePasswordReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = (formData.get('token') ?? '').toString();
  const password = (formData.get('password') ?? '').toString();
  const confirm = (formData.get('confirm') ?? '').toString();

  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (password !== confirm) return { error: 'The two passwords don’t match.' };

  const userId = await checkResetToken(token);
  if (!userId) return { error: 'This reset link is invalid or has expired. Request a new one.' };

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: false } });
  await markResetUsed(token);
  redirect('/login?reset=1');
}
