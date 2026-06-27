'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageAgencyHours } from '@/lib/enums';
import { hhmmToMin } from '@/lib/schedule';

async function requireManager() {
  const user = await getSession();
  if (!user || !canManageAgencyHours(user.roles)) throw new Error('Unauthorized');
  return user;
}

function parse(fd: FormData) {
  return {
    name: String(fd.get('name') ?? '').trim(),
    timezone: String(fd.get('timezone') ?? '').trim(),
    days: (fd.getAll('days') as string[]).map(Number).filter((n) => n >= 0 && n <= 6),
    startMin: hhmmToMin(String(fd.get('start') ?? '09:00')),
    endMin: hhmmToMin(String(fd.get('end') ?? '17:00')),
    note: String(fd.get('note') ?? '').trim() || null,
  };
}

function refresh() {
  revalidatePath('/agency-hours');
  revalidatePath('/');
}

export async function createAgency(fd: FormData) {
  await requireManager();
  const d = parse(fd);
  if (!d.name || !d.timezone) return;
  await prisma.agencySchedule.create({ data: d });
  refresh();
}

export async function updateAgency(fd: FormData) {
  await requireManager();
  const id = String(fd.get('id') ?? '');
  const d = parse(fd);
  if (!id || !d.name || !d.timezone) return;
  await prisma.agencySchedule.update({ where: { id }, data: d });
  refresh();
}

export async function deleteAgency(fd: FormData) {
  await requireManager();
  const id = String(fd.get('id') ?? '');
  if (!id) return;
  await prisma.agencySchedule.delete({ where: { id } });
  refresh();
}
