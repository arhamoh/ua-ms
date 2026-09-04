'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { createMeeting } from '@/lib/google-calendar';

export interface ScheduleResult {
  ok: boolean;
  meetLink?: string;
  htmlLink?: string;
  error?: string;
}

export async function scheduleMeeting(input: {
  title: string;
  startLocal: string;
  durationMin: number;
  attendees: string;
  description?: string;
  withMeet: boolean;
}): Promise<ScheduleResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: 'Not signed in.' };

  const title = (input.title ?? '').trim();
  if (!title) return { ok: false, error: 'Add a title.' };
  if (!input.startLocal) return { ok: false, error: 'Pick a date & time.' };

  const attendees = (input.attendees ?? '')
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);

  try {
    const r = await createMeeting({
      title,
      description: input.description,
      startLocal: input.startLocal,
      durationMin: Number(input.durationMin) || 30,
      attendees,
      withMeet: input.withMeet,
    });
    revalidatePath('/meetings');
    return { ok: true, meetLink: r.meetLink, htmlLink: r.htmlLink };
  } catch (e: any) {
    return { ok: false, error: e?.message?.slice(0, 200) ?? 'Could not create the meeting.' };
  }
}
