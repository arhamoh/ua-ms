'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createSession, destroySession } from '@/lib/auth';

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get('email') ?? '').toString().trim().toLowerCase();
  const password = (formData.get('password') ?? '').toString();

  if (!email || !password) {
    return { error: 'Enter your email and password.' };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: 'Invalid email or password.' };
  }

  await createSession({ id: user.id, name: user.name, email: user.email, roles: user.roles });
  redirect('/');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}
