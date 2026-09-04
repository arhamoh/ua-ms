// Timezone helpers for meeting scheduling. The booking timezone follows the
// calendar integration's GOOGLE_CALENDAR_TZ (default America/Toronto).

export function agencyTz(): string {
  return process.env.GOOGLE_CALENDAR_TZ || 'America/Toronto';
}

/**
 * Convert a `YYYY-MM-DDTHH:MM` wall-clock string in timezone `tz` to the exact
 * UTC instant, handling DST correctly (no external library).
 */
export function zonedTimeToUtc(local: string, tz: string): Date {
  const guess = new Date(`${local.length === 16 ? `${local}:00` : local}Z`); // treat as UTC first
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(guess)
    .reduce((a: Record<string, string>, p) => {
      a[p.type] = p.value;
      return a;
    }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '0' : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  // guess - (asUTC - guess) = 2*guess - asUTC
  return new Date(guess.getTime() * 2 - asUTC);
}
