import 'server-only';
import { googleConnected, getAccessToken } from '@/lib/google';

// Google Calendar + Meet via the unified "Connect Google" account. Events are
// created on the connected account's calendar; Meet links work because we act as
// that real user. This is an optional enhancement — approved meetings still work
// in-platform (with email .ics invites) when Google isn't connected.

const BASE = 'https://www.googleapis.com/calendar/v3';

export function calendarConfigured(): boolean {
  return googleConnected();
}

function calendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID || 'primary';
}

async function api(path: string, init?: RequestInit): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Calendar ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? {} : res.json();
}

export async function testCalendarConnection(): Promise<{ ok: boolean; message: string }> {
  if (!calendarConfigured()) return { ok: false, message: 'Not connected.' };
  try {
    const data = await api(`/calendars/${encodeURIComponent(calendarId())}`);
    return { ok: true, message: `Calendar ready (“${data.summary ?? calendarId()}”).` };
  } catch (e: any) {
    return { ok: false, message: e?.message?.slice(0, 200) ?? 'Connection failed.' };
  }
}

export interface CreateEventInput {
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  attendees?: string[];
  withMeet?: boolean;
}

export async function createEvent(input: CreateEventInput): Promise<{ id: string; htmlLink?: string; meetLink?: string }> {
  if (!calendarConfigured()) throw new Error('Google Calendar is not connected.');
  const body: any = {
    summary: input.title,
    description: input.description || undefined,
    start: { dateTime: input.startAt.toISOString() },
    end: { dateTime: input.endAt.toISOString() },
    attendees: (input.attendees ?? []).filter(Boolean).map((email) => ({ email })),
  };
  let path = `/calendars/${encodeURIComponent(calendarId())}/events?sendUpdates=all`;
  if (input.withMeet) {
    path += '&conferenceDataVersion=1';
    body.conferenceData = {
      createRequest: { requestId: `keel-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } },
    };
  }
  const ev = await api(path, { method: 'POST', body: JSON.stringify(body) });
  return { id: ev.id, htmlLink: ev.htmlLink, meetLink: ev.hangoutLink };
}

export async function deleteEvent(eventId: string): Promise<void> {
  if (!calendarConfigured() || !eventId) return;
  try {
    await api(`/calendars/${encodeURIComponent(calendarId())}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
      method: 'DELETE',
    });
  } catch {
    /* already gone — ignore */
  }
}
