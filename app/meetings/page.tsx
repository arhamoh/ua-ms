import Link from 'next/link';
import { CalendarClock, Video, ExternalLink, Users, Plug } from 'lucide-react';
import { calendarConfigured, listUpcoming, AGENCY_TZ, type UpcomingEvent } from '@/lib/google-calendar';
import MeetingScheduler from '@/components/MeetingScheduler';

export const dynamic = 'force-dynamic';

function fmt(ev: UpcomingEvent): string {
  try {
    if (ev.allDay) {
      return new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: AGENCY_TZ }).format(
        new Date(`${ev.start}T00:00:00`),
      );
    }
    return new Intl.DateTimeFormat('en-CA', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: AGENCY_TZ,
    }).format(new Date(ev.start));
  } catch {
    return ev.start;
  }
}

export default async function MeetingsPage() {
  const configured = calendarConfigured();
  let events: UpcomingEvent[] = [];
  let loadError: string | null = null;
  if (configured) {
    try {
      events = await listUpcoming(12);
    } catch (e: any) {
      loadError = e?.message?.slice(0, 200) ?? 'Could not load the calendar.';
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
      <p className="mt-1 text-sm text-slate-500">Schedule client meetings with a Google Meet link, and see what’s coming up.</p>

      {!configured ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <CalendarClock size={28} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">Google Calendar isn’t connected yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Connect Google Calendar &amp; Meet in Settings → Integrations to schedule meetings and show your upcoming calendar here.
          </p>
          <Link
            href="/settings"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
          >
            <Plug size={15} /> Go to Integrations
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MeetingScheduler tz={AGENCY_TZ} />

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarClock size={18} className="text-brand" />
              <h2 className="text-sm font-semibold">Upcoming</h2>
            </div>

            {loadError ? (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{loadError}</p>
            ) : events.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No upcoming meetings.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {events.map((ev) => (
                  <li key={ev.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-800">{ev.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{fmt(ev)}</div>
                        {ev.attendees.length > 0 && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <Users size={11} /> {ev.attendees.length} invited
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {ev.meetLink && (
                          <a href={ev.meetLink} target="_blank" rel="noreferrer" title="Join Meet" className="text-brand hover:text-brand-dark">
                            <Video size={16} />
                          </a>
                        )}
                        {ev.htmlLink && (
                          <a href={ev.htmlLink} target="_blank" rel="noreferrer" title="Open in Calendar" className="text-slate-400 hover:text-slate-700">
                            <ExternalLink size={15} />
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
