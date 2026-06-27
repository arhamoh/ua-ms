'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** Save the signed-in user's own timezone (used for the header team clocks). */
export async function saveMyTimezone(fd: FormData) {
  const user = await getSession();
  if (!user) throw new Error('Unauthorized');
  const tz = String(fd.get('timezone') ?? '').trim() || null;
  await prisma.user.update({ where: { id: user.id }, data: { timezone: tz } });
  revalidatePath('/settings');
  revalidatePath('/', 'layout'); // header clocks are computed in the root layout
}
