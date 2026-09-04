'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
import type { CalEvent } from '@/lib/meeting-types';

type View = 'month' | 'week' | 'day' | 'agenda';
const VIEWS: View[] = ['month', 'week', 'day', 'agenda'];
const DAY_MS = 86400000;
const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_H = 44; // px per hour in week/day grids

// Convert a UTC instant to a "wall-clock" Date in `tz`, expressed in UTC fields
// so all grid math is timezone-consistent regardless of the viewer's browser tz.
function zoned(iso: string, tz: string): Date {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .formatToParts(new Date(iso))
    .reduce((a: Record<string, string>, x) => ((a[x.type] = x.value), a), {});
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, p.hour === '24' ? 0 : +p.hour, +p.minute));
}
const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const sameDay = (a: Date, b: Date) => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const startOfWeek = (d: Date) => addDays(startOfDay(d), -startOfDay(d).getUTCDay());

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_CLS: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  REQUESTED: 'bg-amber-100 text-amber-800 border-amber-200',
  DECLINED: 'bg-slate-100 text-slate-500 border-slate-200',
  CANCELLED: 'bg-slate-100 text-slate-400 border-slate-200 line-through',
};

interface Ev extends CalEvent {
  s: Date; // zoned start
  e: Date; // zoned end
}

export default function MeetingCalendar({ events, tz }: { events: CalEvent[]; tz: string }) {
  const [view, setView] = useState<View>('month');
  const nowZoned = useMemo(() => zoned(new Date().toISOString(), tz), [tz]);
  const [cursor, setCursor] = useState<Date>(startOfDay(nowZoned));

  const evs: Ev[] = useMemo(
    () => events.map((e) => ({ ...e, s: zoned(e.startISO, tz), e: zoned(e.endISO, tz) })),
    [events, tz],
  );

  const timeFmt = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(d);

  const title = () => {
    if (view === 'week') {
      const ws = startOfWeek(cursor);
      const we = addDays(ws, 6);
      return `${MONTHS[ws.getUTCMonth()].slice(0, 3)} ${ws.getUTCDate()} – ${MONTHS[we.getUTCMonth()].slice(0, 3)} ${we.getUTCDate()}`;
    }
    if (view === 'day') return `${DOW[cursor.getUTCDay()]}, ${MONTHS[cursor.getUTCMonth()]} ${cursor.getUTCDate()}`;
    return `${MONTHS[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`;
  };

  const move = (dir: number) => {
    if (view === 'month') setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + dir, 1)));
    else if (view === 'week') setCursor(addDays(cursor, 7 * dir));
    else if (view === 'day') setCursor(addDays(cursor, dir));
    else setCursor(addDays(cursor, 30 * dir));
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(startOfDay(nowZoned))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Today
          </button>
          <div className="flex items-center">
            <button onClick={() => move(-1)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Previous">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => move(1)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Next">
              <ChevronRight size={18} />
            </button>
          </div>
          <h2 className="text-sm font-semibold text-slate-800">{title()}</h2>
        </div>
        {/* Google-style segmented view switcher */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && <MonthView cursor={cursor} evs={evs} now={nowZoned} onPick={(d) => { setCursor(d); setView('day'); }} timeFmt={timeFmt} />}
      {view === 'week' && <TimeGrid days={weekDays(cursor)} evs={evs} now={nowZoned} timeFmt={timeFmt} />}
      {view === 'day' && <TimeGrid days={[startOfDay(cursor)]} evs={evs} now={nowZoned} timeFmt={timeFmt} />}
      {view === 'agenda' && <AgendaView cursor={cursor} evs={evs} timeFmt={timeFmt} />}

      <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Confirmed</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Pending</span>
      </div>
    </div>
  );
}

function weekDays(cursor: Date): Date[] {
  const ws = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
}

function MonthView({ cursor, evs, now, onPick, timeFmt }: { cursor: Date; evs: Ev[]; now: Date; onPick: (d: Date) => void; timeFmt: (d: Date) => string }) {
  const first = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
  const gridStart = addDays(first, -first.getUTCDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  return (
    <div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {DOW.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-slate-200">
        {cells.map((d, i) => {
          const inMonth = d.getUTCMonth() === cursor.getUTCMonth();
          const dayEvs = evs.filter((e) => sameDay(e.s, d)).sort((a, b) => a.s.getTime() - b.s.getTime());
          const isToday = sameDay(d, now);
          return (
            <button
              key={i}
              onClick={() => onPick(d)}
              className={`min-h-[86px] bg-white p-1.5 text-left align-top ${inMonth ? '' : 'bg-slate-50/60'}`}
            >
              <div className={`mb-1 inline-grid h-5 w-5 place-items-center rounded-full text-[11px] ${isToday ? 'bg-brand text-white' : inMonth ? 'text-slate-600' : 'text-slate-300'}`}>
                {d.getUTCDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvs.slice(0, 3).map((e) => (
                  <div key={e.id} className={`truncate rounded border px-1 py-0.5 text-[10px] leading-tight ${STATUS_CLS[e.status]}`} title={`${timeFmt(e.s)} · ${e.title}`}>
                    {timeFmt(e.s)} {e.title}
                  </div>
                ))}
                {dayEvs.length > 3 && <div className="pl-1 text-[10px] text-slate-400">+{dayEvs.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Column-packing for overlapping events within one day.
function packColumns(dayEvs: Ev[]): { ev: Ev; col: number; cols: number }[] {
  const sorted = [...dayEvs].sort((a, b) => a.s.getTime() - b.s.getTime() || a.e.getTime() - b.e.getTime());
  const out: { ev: Ev; col: number; cols: number }[] = [];
  let cluster: Ev[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const colsEnd: number[] = [];
    const placed = cluster.map((ev) => {
      let col = colsEnd.findIndex((end) => end <= ev.s.getTime());
      if (col === -1) { col = colsEnd.length; colsEnd.push(0); }
      colsEnd[col] = ev.e.getTime();
      return { ev, col };
    });
    const cols = colsEnd.length;
    placed.forEach((p) => out.push({ ...p, cols }));
    cluster = [];
    clusterEnd = 0;
  };
  for (const ev of sorted) {
    if (cluster.length && ev.s.getTime() >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.e.getTime());
  }
  if (cluster.length) flush();
  return out;
}

function TimeGrid({ days, evs, now, timeFmt }: { days: Date[]; evs: Ev[]; now: Date; timeFmt: (d: Date) => string }) {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const gridH = (END_HOUR - START_HOUR) * HOUR_H;
  const topFor = (d: Date) => (Math.max(START_HOUR, d.getUTCHours() + d.getUTCMinutes() / 60) - START_HOUR) * HOUR_H;

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[560px]">
        {/* hour gutter */}
        <div className="w-12 shrink-0 pt-6">
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_H }} className="relative">
              <span className="absolute -top-2 right-1 text-[10px] text-slate-400">{h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'a' : 'p'}</span>
            </div>
          ))}
        </div>
        {/* day columns */}
        <div className="flex flex-1">
          {days.map((day, di) => {
            const dayEvs = evs.filter((e) => sameDay(e.s, day));
            const placed = packColumns(dayEvs);
            const isToday = sameDay(day, now);
            return (
              <div key={di} className="relative flex-1 border-l border-slate-100">
                <div className={`sticky top-0 z-10 bg-white pb-1 text-center text-[11px] font-medium ${isToday ? 'text-brand' : 'text-slate-500'}`}>
                  {DOW[day.getUTCDay()]} {day.getUTCDate()}
                </div>
                <div className="relative" style={{ height: gridH }}>
                  {hours.slice(0, -1).map((h) => (
                    <div key={h} style={{ height: HOUR_H }} className="border-t border-slate-100" />
                  ))}
                  {placed.map(({ ev, col, cols }) => {
                    const top = topFor(ev.s);
                    const height = Math.max(18, topFor(ev.e) - top);
                    const width = 100 / cols;
                    const chip = (
                      <div
                        className={`absolute overflow-hidden rounded-md border px-1 py-0.5 text-[10px] leading-tight ${STATUS_CLS[ev.status]}`}
                        style={{ top, height, left: `${col * width}%`, width: `calc(${width}% - 2px)` }}
                        title={`${timeFmt(ev.s)}–${timeFmt(ev.e)} · ${ev.title}`}
                      >
                        <div className="font-medium">{ev.title}</div>
                        <div className="opacity-70">{timeFmt(ev.s)}</div>
                      </div>
                    );
                    return ev.meetLink ? (
                      <a key={ev.id} href={ev.meetLink} target="_blank" rel="noreferrer">{chip}</a>
                    ) : (
                      <div key={ev.id}>{chip}</div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AgendaView({ cursor, evs, timeFmt }: { cursor: Date; evs: Ev[]; timeFmt: (d: Date) => string }) {
  const from = startOfDay(cursor).getTime();
  const to = from + 45 * DAY_MS;
  const upcoming = evs.filter((e) => e.s.getTime() >= from && e.s.getTime() <= to).sort((a, b) => a.s.getTime() - b.s.getTime());
  if (upcoming.length === 0) return <p className="py-8 text-center text-sm text-slate-400">Nothing scheduled in this range.</p>;

  const groups: Record<string, Ev[]> = {};
  for (const e of upcoming) {
    const key = `${e.s.getUTCFullYear()}-${e.s.getUTCMonth()}-${e.s.getUTCDate()}`;
    (groups[key] ??= []).push(e);
  }
  return (
    <div className="divide-y divide-slate-100">
      {Object.values(groups).map((day, i) => (
        <div key={i} className="flex gap-4 py-3">
          <div className="w-16 shrink-0 text-xs">
            <div className="font-semibold text-slate-700">{DOW[day[0].s.getUTCDay()]}</div>
            <div className="text-slate-400">{MONTHS[day[0].s.getUTCMonth()].slice(0, 3)} {day[0].s.getUTCDate()}</div>
          </div>
          <div className="flex-1 space-y-1.5">
            {day.map((e) => (
              <div key={e.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${STATUS_CLS[e.status]}`}>
                <span className="w-24 shrink-0 font-medium">{timeFmt(e.s)}–{timeFmt(e.e)}</span>
                <span className="min-w-0 flex-1 truncate">{e.title}</span>
                {e.meetLink && (
                  <a href={e.meetLink} target="_blank" rel="noreferrer" className="shrink-0"><Video size={14} /></a>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
