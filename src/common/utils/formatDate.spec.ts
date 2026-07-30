import {
  formatDuration,
  getEtWeekWindow,
  getZonedDateParts,
  zonedWallClockToUtc,
} from './formatDate';

const ET = 'America/New_York';

describe('getZonedDateParts', () => {
  it('maps every weekday correctly in ET', () => {
    // 2026-07-26 is a Sunday. Use 16:00Z so the ET civil date matches the UTC one.
    const expected = [0, 1, 2, 3, 4, 5, 6];
    expected.forEach((weekday, offset) => {
      const date = new Date(Date.UTC(2026, 6, 26 + offset, 16, 0, 0));
      expect(getZonedDateParts(date, ET).weekday).toBe(weekday);
    });
  });

  it('returns the ET civil date, not the UTC one, after ET midnight rollover', () => {
    // 2026-07-28T02:00:00Z is still 2026-07-27 22:00 in ET.
    const parts = getZonedDateParts(new Date('2026-07-28T02:00:00Z'), ET);
    expect(parts).toMatchObject({ year: 2026, month: 7, day: 27 });
  });
});

describe('zonedWallClockToUtc', () => {
  it('converts an EDT wall-clock time using a -04:00 offset', () => {
    const utc = zonedWallClockToUtc(2026, 7, 27, 0, 0, 0, 0, ET);
    expect(utc.toISOString()).toBe('2026-07-27T04:00:00.000Z');
  });

  it('converts an EST wall-clock time using a -05:00 offset', () => {
    const utc = zonedWallClockToUtc(2026, 1, 26, 0, 0, 0, 0, ET);
    expect(utc.toISOString()).toBe('2026-01-26T05:00:00.000Z');
  });

  it('preserves milliseconds', () => {
    const utc = zonedWallClockToUtc(2026, 7, 31, 23, 59, 59, 999, ET);
    expect(utc.toISOString()).toBe('2026-08-01T03:59:59.999Z');
  });
});

describe('getEtWeekWindow', () => {
  it('returns Mon 00:00 ET to Fri 23:59:59.999 ET for an EDT Friday', () => {
    const { start, end } = getEtWeekWindow(
      new Date('2026-07-31T13:00:00Z'),
      ET,
    );
    expect(start.toISOString()).toBe('2026-07-27T04:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-01T03:59:59.999Z');
  });

  it('returns the EST-offset window for a January Friday', () => {
    const { start, end } = getEtWeekWindow(
      new Date('2026-01-30T14:00:00Z'),
      ET,
    );
    expect(start.toISOString()).toBe('2026-01-26T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-01-31T04:59:59.999Z');
  });

  it('keeps the same week when run at 23:30 ET Friday (already Saturday in UTC)', () => {
    // 2026-07-31T23:30:00-04:00 === 2026-08-01T03:30:00Z
    const { start, end } = getEtWeekWindow(
      new Date('2026-08-01T03:30:00Z'),
      ET,
    );
    expect(start.toISOString()).toBe('2026-07-27T04:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-01T03:59:59.999Z');
  });

  it('computes each boundary with the offset in effect during the spring-forward week', () => {
    // DST starts Sun 2026-03-08. Mon 03-09 through Fri 03-13 are both EDT.
    const { start, end } = getEtWeekWindow(
      new Date('2026-03-13T14:00:00Z'),
      ET,
    );
    expect(start.toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-14T03:59:59.999Z');
  });

  it('computes each boundary with the offset in effect during the fall-back week', () => {
    // DST ends Sun 2026-11-01. Mon 11-02 through Fri 11-06 are both EST.
    const { start, end } = getEtWeekWindow(
      new Date('2026-11-06T15:00:00Z'),
      ET,
    );
    expect(start.toISOString()).toBe('2026-11-02T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-07T04:59:59.999Z');
  });

  it('crosses the year boundary when Friday is Jan 1', () => {
    // Fri 2027-01-01; its Monday is 2026-12-28.
    const { start, end } = getEtWeekWindow(
      new Date('2027-01-01T15:00:00Z'),
      ET,
    );
    expect(start.toISOString()).toBe('2026-12-28T05:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-02T04:59:59.999Z');
  });

  it('reports the week that just ended when run on Saturday or Sunday', () => {
    const sat = getEtWeekWindow(new Date('2026-08-01T16:00:00Z'), ET);
    const sun = getEtWeekWindow(new Date('2026-08-02T16:00:00Z'), ET);
    expect(sat.start.toISOString()).toBe('2026-07-27T04:00:00.000Z');
    expect(sat.end.toISOString()).toBe('2026-08-01T03:59:59.999Z');
    expect(sun.start.toISOString()).toBe('2026-07-27T04:00:00.000Z');
  });

  it('reports the current, incomplete week when run Monday through Thursday', () => {
    const wed = getEtWeekWindow(new Date('2026-07-29T14:00:00Z'), ET);
    expect(wed.start.toISOString()).toBe('2026-07-27T04:00:00.000Z');
    expect(wed.end.toISOString()).toBe('2026-08-01T03:59:59.999Z');
  });

  it('exposes human-readable ET labels for the boundaries', () => {
    const { mondayLabel, fridayLabel } = getEtWeekWindow(
      new Date('2026-07-31T13:00:00Z'),
      ET,
    );
    expect(mondayLabel).toBe('Jul 27, 2026');
    expect(fridayLabel).toBe('Jul 31, 2026');
  });
});

describe('formatDuration', () => {
  const base = Date.UTC(2026, 6, 27, 12, 0, 0);

  it('renders minutes under an hour', () => {
    expect(formatDuration(base, base + 45 * 60000)).toBe('45m');
  });

  it('renders hours and minutes under a day', () => {
    expect(formatDuration(base, base + (3 * 60 + 20) * 60000)).toBe('3h 20m');
  });

  it('renders days and hours beyond 24 hours', () => {
    expect(formatDuration(base, base + (2 * 24 + 4) * 3600000)).toBe('2d 4h');
  });

  it('clamps a negative interval to zero rather than emitting a negative string', () => {
    expect(formatDuration(base, base - 60 * 60000)).toBe('0m');
  });
});
