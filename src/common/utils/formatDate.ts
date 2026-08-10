export function formatTimestampToUSShort(timestamp: number | string): string {
  const ts = Number(timestamp);
  const d = new Date(timestamp);

  console.log('Formatting timestamp:', ts, 'to date:', d);

  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const year = String(d.getUTCFullYear()).slice(-2);

  return `${month}/${day}/${year}`;
}

export function dateToTimestamp(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }
  const [year, month, day] = dateString.split('-').map(Number);

  const timestamp = Date.UTC(year, month - 1, day, 0, 0, 0);

  return String(timestamp); // em milissegundos
}

export function timestampToUSDate(timestamp) {
  if (!timestamp) return null;

  const ts = Number(timestamp);

  if (isNaN(ts)) {
    //console.error("invalid Timestamp:", timestamp);
    return null;
  }
  const date = new Date(ts);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${month}/${day}/${year}`;
}

export function timestampToDate(timestamp: string | number): Date | null {
  if (!timestamp) return null;
  const ts = Number(timestamp);
  if (isNaN(ts)) return null;
  return new Date(ts);
}

//This function formats a Date object to 'YYYY-MM-DD' format for CA locale considering the specified time zone.
//en-CA locale is used because it follows the 'YYYY-MM-DD' format.
export function formatDateForCA(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;

  return `${year}-${month}-${day}`;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Minutes that `timeZone` is behind UTC at `date` (ET: 240 in EDT, 300 in EST).
function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);

  // Some ICU builds report midnight as hour 24 under hour12:false.
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );

  // formatToParts drops sub-second precision, so compare against a floored
  // instant — otherwise the milliseconds leak into the offset and skew it.
  const flooredInput = Math.floor(date.getTime() / 1000) * 1000;
  return (flooredInput - asUtc) / 60000;
}

// Calendar date + weekday (0=Sun..6=Sat) of `date` as seen in `timeZone`.
export function getZonedDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: WEEKDAY_INDEX[get('weekday')],
  };
}

// Resolves a wall-clock time in `timeZone` to the real UTC instant. Native Date
// cannot do this directly, so probe the zone offset at a naive guess and correct
// by it; a second probe fixes the case where the guess straddled a DST change.
export function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const firstOffset = getTimeZoneOffsetMinutes(new Date(naive), timeZone);
  const firstGuess = new Date(naive + firstOffset * 60000);

  const secondOffset = getTimeZoneOffsetMinutes(firstGuess, timeZone);
  return secondOffset === firstOffset
    ? firstGuess
    : new Date(naive + secondOffset * 60000);
}

// Rolling 8-day window: 00:00:00.000 of the civil day 7 days before `now`
// through `now` itself, in `timeZone`. Run on a Friday it spans last Friday to
// this Friday, and the 8th day makes consecutive reports overlap by one day
// rather than dropping panels created after the previous run.
//
// The window closes at `now`, not at the end of the civil day, because the
// report is dispatched mid-morning — an end-of-day boundary would advertise
// hours that have not happened yet.
export function getRollingReportWindow(
  now: Date = new Date(),
  timeZone = 'America/Los_Angeles',
): { start: Date; end: Date; weekStartLabel: string; weekEndLabel: string } {
  const { year, month, day } = getZonedDateParts(now, timeZone);

  // Shift the civil date from a UTC-noon anchor: UTC has no DST, so whole-day
  // millisecond arithmetic can never roll the calendar date by accident.
  const startDay = new Date(Date.UTC(year, month - 1, day, 12) - 7 * 86400000);

  // Resolved against its own civil date: a window spanning a DST change has a
  // different UTC offset at its start than at its end.
  const start = zonedWallClockToUtc(
    startDay.getUTCFullYear(),
    startDay.getUTCMonth() + 1,
    startDay.getUTCDate(),
    0,
    0,
    0,
    0,
    timeZone,
  );

  const label = (date: Date) =>
    date.toLocaleDateString('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return {
    start,
    end: now,
    weekStartLabel: label(start),
    weekEndLabel: label(now),
  };
}

// Elapsed time as '45m' / '3h 20m' / '2d 4h'. Clamped at zero because stored
// tracker timestamps can be out of order (e.g. decided_at before viewed_at).
export function formatDuration(fromMs: number, toMs: number): string {
  const minutes = Math.max(0, Math.round((toMs - fromMs) / 60000));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;

  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function getNowInTimezone(timeZone: string): Date {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(date);
  const extract = (type: string) => parts.find((p) => p.type === type)?.value;

  const year = extract('year');
  const month = extract('month');
  const day = extract('day');
  const hour = extract('hour');
  const minute = extract('minute');
  const second = extract('second');
  const fractionalSecond = extract('fractionalSecond') || '000';

  // Create date as UTC so the "wall clock" time is preserved in the Date object
  // e.g. 15:00 Sao Paulo -> 15:00 UTC
  const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}.${fractionalSecond}Z`;
  return new Date(isoString);
}
