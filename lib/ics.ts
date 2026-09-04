// Minimal iCalendar (.ics) generator so a booked meeting lands in ANY calendar
// (Google, Outlook, Apple) via an email attachment — no integration required.

export interface IcsInput {
  uid: string;
  title: string;
  description?: string | null;
  start: Date;
  end: Date;
  organizerEmail?: string | null;
  organizerName?: string | null;
  attendees?: string[];
  meetLink?: string | null;
  status?: 'CONFIRMED' | 'CANCELLED';
}

function toIcsDate(d: Date): string {
  // UTC basic format: 20260904T143000Z
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

export function buildIcs(input: IcsInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Keel//Meetings//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${input.status === 'CANCELLED' ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(input.start)}`,
    `DTEND:${toIcsDate(input.end)}`,
    `SUMMARY:${esc(input.title)}`,
    `STATUS:${input.status ?? 'CONFIRMED'}`,
  ];
  const descParts: string[] = [];
  if (input.description) descParts.push(input.description);
  if (input.meetLink) descParts.push(`Join Google Meet: ${input.meetLink}`);
  if (descParts.length) lines.push(`DESCRIPTION:${esc(descParts.join('\n\n'))}`);
  if (input.meetLink) lines.push(`LOCATION:${esc(input.meetLink)}`);
  if (input.organizerEmail) {
    lines.push(`ORGANIZER;CN=${esc(input.organizerName ?? input.organizerEmail)}:mailto:${input.organizerEmail}`);
  }
  for (const a of input.attendees ?? []) {
    if (a) lines.push(`ATTENDEE;RSVP=TRUE:mailto:${a}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

/** Base64 of an .ics for use as an email attachment. */
export function icsAttachment(input: IcsInput): { filename: string; content: string } {
  return { filename: 'invite.ics', content: Buffer.from(buildIcs(input), 'utf8').toString('base64') };
}
