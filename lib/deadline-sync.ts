import { ProjectStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calendarConfigured, createAllDayEvent, deleteEvent } from '@/lib/google-calendar';

// Mirror project deadlines onto the connected Google Calendar as all-day events.
// Idempotent: tracks the synced event id + the deadline it was synced for, so it
// only touches Google when something actually changed. Safe to run repeatedly
// (e.g. on the cron).
const CLOSED = [ProjectStatus.CANCELLED, ProjectStatus.ARCHIVED, ProjectStatus.COMPLETED];

export async function syncAllDeadlines(): Promise<{ created: number; updated: number; removed: number; skipped?: string }> {
  if (!calendarConfigured()) return { created: 0, updated: 0, removed: 0, skipped: 'google-not-connected' };
  let created = 0;
  let updated = 0;
  let removed = 0;

  // 1) Remove calendar events for projects that lost their deadline or closed.
  const stale = await prisma.project.findMany({
    where: { deadlineEventId: { not: null }, OR: [{ deadline: null }, { status: { in: CLOSED } }] },
    select: { id: true, deadlineEventId: true },
  });
  for (const p of stale) {
    await deleteEvent(p.deadlineEventId!);
    await prisma.project.update({ where: { id: p.id }, data: { deadlineEventId: null, deadlineSyncedFor: null } });
    removed++;
  }

  // 2) Create / refresh events for active projects with a deadline.
  const active = await prisma.project.findMany({
    where: { deadline: { not: null }, status: { notIn: CLOSED } },
    include: { client: { select: { name: true } } },
  });
  for (const p of active) {
    const changed = !p.deadlineEventId || !p.deadlineSyncedFor || p.deadlineSyncedFor.getTime() !== p.deadline!.getTime();
    if (!changed) continue;
    const had = !!p.deadlineEventId;
    if (p.deadlineEventId) await deleteEvent(p.deadlineEventId);
    try {
      const ev = await createAllDayEvent({
        date: p.deadline!,
        title: `Deadline: ${p.name}${p.client ? ` · ${p.client.name}` : ''}`,
        description: 'Project deadline (from Keel).',
      });
      await prisma.project.update({ where: { id: p.id }, data: { deadlineEventId: ev.id, deadlineSyncedFor: p.deadline } });
      had ? updated++ : created++;
    } catch {
      /* skip this one; try again next run */
    }
  }

  return { created, updated, removed };
}
