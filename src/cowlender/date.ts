import type { CowlenderEvent } from './types';

export interface CalendarMonth {
  year: number;
  month: number;
}

export interface MonthGrid {
  days: string[];
  rangeStart: string;
  rangeEnd: string;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateFromIso(value: string): Date {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    throw new Error('Invalid calendar date.');
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function isoDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month, day));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(value: string, amount: number): string {
  const date = dateFromIso(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return isoDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function monthForDate(value: string): CalendarMonth {
  const date = dateFromIso(value);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function buildMonthGrid(value: CalendarMonth): MonthGrid {
  const first = new Date(Date.UTC(value.year, value.month, 1));
  const last = new Date(Date.UTC(value.year, value.month + 1, 0));
  const leadingDays = first.getUTCDay();
  const daysInMonth = last.getUTCDate();
  const cellCount = Math.max(35, Math.ceil((leadingDays + daysInMonth) / 7) * 7);
  const rangeStart = isoDate(value.year, value.month, 1 - leadingDays);
  const days = Array.from({ length: cellCount }, (_, index) => addDays(rangeStart, index));

  return {
    days,
    rangeStart,
    rangeEnd: addDays(rangeStart, cellCount),
  };
}

export function todayInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function timeZoneParts(instant: Date, timeZone: string): Record<string, number> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }
  return values;
}

function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = timeZoneParts(instant, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((representedAsUtc - instant.getTime()) / 60000);
}

function offsetString(offset: number): string {
  const sign = offset >= 0 ? '+' : '-';
  const absolute = Math.abs(offset);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

export function zonedLocalToRfc3339(value: string, timeZone: string): string {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) {
    throw new Error('Enter both a valid date and time.');
  }

  const desired = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const wallClockAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    0,
  );

  let offset = offsetMinutes(new Date(wallClockAsUtc), timeZone);
  let instant = new Date(wallClockAsUtc - offset * 60000);
  const correctedOffset = offsetMinutes(instant, timeZone);
  if (correctedOffset !== offset) {
    offset = correctedOffset;
    instant = new Date(wallClockAsUtc - offset * 60000);
  }

  const actual = timeZoneParts(instant, timeZone);
  if (
    actual.year !== desired.year
    || actual.month !== desired.month
    || actual.day !== desired.day
    || actual.hour !== desired.hour
    || actual.minute !== desired.minute
  ) {
    throw new Error('That local time does not exist in the selected timezone due to daylight saving time.');
  }

  return `${value}:00${offsetString(offset)}`;
}

export function eventDateRangeLabel(event: CowlenderEvent): string {
  if (event.allDay) {
    const inclusiveEnd = addDays(event.end, -1);
    const startLabel = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(dateFromIso(event.start));
    if (inclusiveEnd === event.start) {
      return `${startLabel} · All day`;
    }
    const endLabel = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(dateFromIso(inclusiveEnd));
    return `${startLabel} – ${endLabel} · All day`;
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: event.timezone,
  });
  return `${formatter.format(new Date(event.start))} – ${formatter.format(new Date(event.end))}`;
}
