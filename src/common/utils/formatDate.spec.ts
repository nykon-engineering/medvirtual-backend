import {
  formatDuration,
  getRollingReportWindow,
  getZonedDateParts,
  zonedWallClockToUtc,
} from './formatDate';

const ET = 'America/New_York';
const PT = 'America/Los_Angeles';

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

describe('getRollingReportWindow', () => {
  // 2026-07-31T17:00:00Z === Fri 2026-07-31 10:00 PDT, the scheduled run time.
  const PDT_FRIDAY_RUN = new Date('2026-07-31T17:00:00Z');

  it('spans last Friday 00:00 PT through the run instant on a PDT Friday', () => {
    const { start, end } = getRollingReportWindow(PDT_FRIDAY_RUN, PT);
    expect(start.toISOString()).toBe('2026-07-24T07:00:00.000Z');
    expect(end.toISOString()).toBe(PDT_FRIDAY_RUN.toISOString());
  });

  it('uses the PST offset for a January Friday', () => {
    // Fri 2026-01-30 10:00 PST === 18:00Z.
    const { start, end } = getRollingReportWindow(
      new Date('2026-01-30T18:00:00Z'),
      PT,
    );
    expect(start.toISOString()).toBe('2026-01-23T08:00:00.000Z');
    expect(end.toISOString()).toBe('2026-01-30T18:00:00.000Z');
  });

  it('covers exactly 8 civil days, so the previous run day is included', () => {
    const { start, end } = getRollingReportWindow(PDT_FRIDAY_RUN, PT);
    // A panel created just after the previous Friday run would be dropped by a
    // 7-day window; the 8th day is what makes consecutive reports overlap.
    const lastFridayMorning = new Date('2026-07-24T17:30:00Z');
    const lastSaturday = new Date('2026-07-25T18:00:00Z');

    expect(lastFridayMorning >= start && lastFridayMorning <= end).toBe(true);
    expect(lastSaturday >= start && lastSaturday <= end).toBe(true);
  });

  it('excludes the instant before the window opens', () => {
    const { start } = getRollingReportWindow(PDT_FRIDAY_RUN, PT);
    const justBefore = new Date(start.getTime() - 1);
    expect(justBefore >= start).toBe(false);
  });

  it('resolves the start with the offset in effect during the spring-forward week', () => {
    // DST starts Sun 2026-03-08: the start (Fri 03-06) is still PST (-08:00)
    // while the run instant (Fri 03-13 10:00) is already PDT (-07:00).
    const { start, end } = getRollingReportWindow(
      new Date('2026-03-13T17:00:00Z'),
      PT,
    );
    expect(start.toISOString()).toBe('2026-03-06T08:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-13T17:00:00.000Z');
  });

  it('resolves the start with the offset in effect during the fall-back week', () => {
    // DST ends Sun 2026-11-01: the start (Fri 10-30) is still PDT (-07:00)
    // while the run instant (Fri 11-06 10:00) is already PST (-08:00).
    const { start, end } = getRollingReportWindow(
      new Date('2026-11-06T18:00:00Z'),
      PT,
    );
    expect(start.toISOString()).toBe('2026-10-30T07:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-06T18:00:00.000Z');
  });

  it('crosses the year boundary when the run day is Jan 1', () => {
    // Fri 2027-01-01 10:00 PST; the window opens on Fri 2026-12-25.
    const { start } = getRollingReportWindow(
      new Date('2027-01-01T18:00:00Z'),
      PT,
    );
    expect(start.toISOString()).toBe('2026-12-25T08:00:00.000Z');
  });

  it('anchors on the PT civil day, not the UTC one, for a late-evening run', () => {
    // 2026-08-01T04:00:00Z is already Saturday in UTC but still Fri 21:00 PT,
    // so the window must open on Fri 2026-07-24.
    const { start } = getRollingReportWindow(
      new Date('2026-08-01T04:00:00Z'),
      PT,
    );
    expect(start.toISOString()).toBe('2026-07-24T07:00:00.000Z');
  });

  it('exposes human-readable PT labels for the boundaries', () => {
    const { weekStartLabel, weekEndLabel } = getRollingReportWindow(
      PDT_FRIDAY_RUN,
      PT,
    );
    expect(weekStartLabel).toBe('Jul 24, 2026');
    expect(weekEndLabel).toBe('Jul 31, 2026');
  });

  it('honours a non-default time zone for the day boundary', () => {
    // Same instant, ET: 13:00 ET on Fri 07-31, so the window opens at
    // Fri 2026-07-24 00:00 EDT (-04:00) instead of PT's -07:00.
    const { start } = getRollingReportWindow(PDT_FRIDAY_RUN, ET);
    expect(start.toISOString()).toBe('2026-07-24T04:00:00.000Z');
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
