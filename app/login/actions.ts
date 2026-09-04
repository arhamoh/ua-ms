'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createSession, destroySession } from '@/lib/auth';

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = (formData.get('email') ?? '').toString().trim().toLowerCase();
  const password = (formData.get('password') ?? '').toString();

  if (!identifier || !password) {
    return { error: 'Enter your username or email and password.' };
  }

  // Match on email OR username (username stored lowercase).
  const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] } });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: 'Invalid login or password.' };
  }

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    mustChangePassword: user.mustChangePassword,
  });
  redirect(user.mustChangePassword ? '/change-password' : '/');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}
