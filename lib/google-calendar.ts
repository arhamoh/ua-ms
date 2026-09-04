import 'server-only';
import { JWT } from 'google-auth-library';

// Google Calendar + Meet via the same service account used for Drive, using
// domain-wide delegation to act as a real Workspace user (required to create
// Meet links). This is an OPTIONAL enhancement layered on top of the in-platform
// meetings: when connected, an approved meeting is mirrored to Google Calendar
// with a Meet link and the attendees are invited by email.

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const BASE = 'https://www.googleapis.com/calendar/v3';

export function calendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL);
}

function calendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID || 'primary';
}

async function getAccessToken(): Promise<string> {
  const json = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string);
  const jwt = new JWT({
    email: json.client_email,
    key: json.private_key,
    scopes: SCOPES,
    subject: process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL, // domain-wide delegation
  });
  const { access_token } = await jwt.authorize();
  if (!access_token) throw new Error('No access token — check domain-wide delegation for the service account.');
  return access_token;
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

/** Live check for the Settings integrations panel. */
export async function testCalendarConnection(): Promise<{ ok: boolean; message: string }> {
  if (!calendarConfigured()) return { ok: false, message: 'Not configured.' };
  try {
    const data = await api(`/calendars/${encodeURIComponent(calendarId())}`);
    return { ok: true, message: `Connected to “${data.summary ?? calendarId()}”.` };
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

/** Create a calendar event (optionally with a Meet link) and invite attendees.
 *  Returns the event id, its Calendar link, and the Meet link if requested. */
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

/** Delete a previously-created event (best-effort; ignores 404/410). */
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
