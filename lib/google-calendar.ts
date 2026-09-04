import 'server-only';
import { JWT } from 'google-auth-library';

// Google Calendar + Meet via the same service account used for Drive, using
// domain-wide delegation to act as a real Workspace user (required to create
// Meet links). The Workspace admin must grant this service account the calendar
// scope, and GOOGLE_CALENDAR_IMPERSONATE_EMAIL names the user whose calendar we
// act on.

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const BASE = 'https://www.googleapis.com/calendar/v3';

export function calendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL);
}

function calendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID || 'primary';
}

/** Default wall-clock timezone for events booked from Keel. */
export const AGENCY_TZ = process.env.GOOGLE_CALENDAR_TZ || 'America/Toronto';

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
  return res.json();
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

export interface UpcomingEvent {
  id: string;
  title: string;
  start: string; // ISO datetime or date
  end?: string;
  meetLink?: string;
  htmlLink?: string;
  attendees: string[];
  allDay: boolean;
}

/** Upcoming events on the agency calendar, soonest first. */
export async function listUpcoming(maxResults = 8): Promise<UpcomingEvent[]> {
  if (!calendarConfigured()) return [];
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
  });
  const data = await api(`/calendars/${encodeURIComponent(calendarId())}/events?${params.toString()}`);
  return (data.items ?? []).map((ev: any) => ({
    id: ev.id,
    title: ev.summary ?? '(no title)',
    start: ev.start?.dateTime ?? ev.start?.date,
    end: ev.end?.dateTime ?? ev.end?.date,
    meetLink: ev.hangoutLink,
    htmlLink: ev.htmlLink,
    attendees: (ev.attendees ?? []).map((a: any) => a.email).filter(Boolean),
    allDay: !ev.start?.dateTime,
  }));
}

// Add minutes to a `YYYY-MM-DDTHH:MM` wall-clock string, timezone-agnostically.
function addMinutesLocal(local: string, mins: number): string {
  const [d, t] = local.split('T');
  const [Y, Mo, Da] = d.split('-').map(Number);
  const [H, Mi] = (t ?? '00:00').split(':').map(Number);
  const dt = new Date(Date.UTC(Y, Mo - 1, Da, H, Mi) + mins * 60000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}T${p(dt.getUTCHours())}:${p(dt.getUTCMinutes())}`;
}

export interface CreateMeetingInput {
  title: string;
  description?: string;
  startLocal: string; // 'YYYY-MM-DDTHH:MM' in AGENCY_TZ
  durationMin: number;
  attendees?: string[];
  withMeet?: boolean;
}

/** Create a calendar event (optionally with a Google Meet link) and invite the
 *  attendees. Returns the event link and Meet link. */
export async function createMeeting(input: CreateMeetingInput): Promise<{ id: string; htmlLink?: string; meetLink?: string }> {
  if (!calendarConfigured()) throw new Error('Google Calendar is not connected.');
  const endLocal = addMinutesLocal(input.startLocal, Math.max(15, input.durationMin));
  const body: any = {
    summary: input.title,
    description: input.description || undefined,
    start: { dateTime: `${input.startLocal}:00`, timeZone: AGENCY_TZ },
    end: { dateTime: `${endLocal}:00`, timeZone: AGENCY_TZ },
    attendees: (input.attendees ?? []).map((email) => ({ email })),
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
