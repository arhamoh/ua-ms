// Timezone + working-hours helpers. Pure and client-safe (Intl is universal).

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Current weekday (0=Sun..6=Sat) and minutes-from-midnight in a given tz. */
export function zonedNow(tz: string, date: Date = new Date()): { weekday: number; minutes: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    let hour = Number(get('hour'));
    if (hour === 24) hour = 0; // some engines render midnight as 24
    const minute = Number(get('minute'));
    const weekday = DAY_LABELS.indexOf(get('weekday'));
    return { weekday, minutes: hour * 60 + minute };
  } catch {
    return { weekday: -1, minutes: 0 };
  }
}

/** Is the agency currently within its agreed working window? */
export function isOpenNow(
  days: number[],
  startMin: number,
  endMin: number,
  tz: string,
  date: Date = new Date(),
): boolean {
  const { weekday, minutes } = zonedNow(tz, date);
  if (weekday < 0 || !days.includes(weekday)) return false;
  if (endMin > startMin) return minutes >= startMin && minutes < endMin; // same-day window
  return minutes >= startMin || minutes < endMin; // crosses midnight
}

/** Live clock string in a tz, e.g. "3:45:09 PM". */
export function formatTimeInTz(tz: string, date: Date = new Date(), withSeconds = false): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      ...(withSeconds ? { second: '2-digit' } : {}),
      hour12: true,
    }).format(date);
  } catch {
    return '—';
  }
}

/** Short weekday in a tz, e.g. "Mon". */
export function formatDayInTz(tz: string, date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);
  } catch {
    return '';
  }
}

/** A timezone's current UTC offset in minutes (positive = ahead of UTC). */
export function tzOffsetMinutes(tz: string, date: Date = new Date()): number {
  try {
    const asTz = new Date(date.toLocaleString('en-US', { timeZone: tz }));
    const asUtc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    return Math.round((asTz.getTime() - asUtc.getTime()) / 60000);
  } catch {
    return NaN;
  }
}

/** Friendly label for a tz id, e.g. "Asia/Karachi" -> "Karachi". */
export function tzLabel(tz: string): string {
  const seg = tz.split('/').pop() ?? tz;
  return seg.replace(/_/g, ' ');
}

/** Minutes-from-midnight -> "9:00 AM". */
export function minToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** "HH:MM" -> minutes-from-midnight. */
export function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** minutes-from-midnight -> "HH:MM" (for <input type=time>). */
export function minToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** The full IANA timezone list (for pickers), with a sensible fallback. */
export function allTimezones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['America/Toronto', 'America/New_York', 'America/Los_Angeles', 'Asia/Karachi', 'Europe/London', 'UTC'];
  }
}
