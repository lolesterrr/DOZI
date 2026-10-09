import {
  addDays,
  currentStudyDay,
  dayOfWeek,
  dayRange,
  daysBetween,
  DEFAULT_TIMEZONE,
  isDayString,
  isValidTimeZone,
  localDate,
  nowIso,
  studyDay,
  studyDayEnd,
  studyDayStart,
  toIso,
} from '../time';

// Africa/Kampala is UTC+3 all year (no daylight saving).
describe('studyDay — 03:00 rollover in Africa/Kampala', () => {
  it('uses Africa/Kampala by default', () => {
    expect(DEFAULT_TIMEZONE).toBe('Africa/Kampala');
    expect(studyDay('2026-10-09T00:01:00Z')).toBe('2026-10-09'); // 03:01 in Kampala
  });

  it('counts 02:59 as the day before', () => {
    expect(studyDay('2026-10-08T23:59:00Z', 'Africa/Kampala')).toBe('2026-10-08');
  });

  it('counts 03:01 as the new day', () => {
    expect(studyDay('2026-10-09T00:01:00Z', 'Africa/Kampala')).toBe('2026-10-09');
  });

  it('starts the new day at exactly 03:00:00, not a millisecond earlier', () => {
    expect(studyDay('2026-10-09T00:00:00.000Z', 'Africa/Kampala')).toBe('2026-10-09');
    expect(studyDay('2026-10-08T23:59:59.999Z', 'Africa/Kampala')).toBe('2026-10-08');
  });

  it('keeps a late-night session (23:00 to 02:30) on one study day', () => {
    const start = studyDay('2026-10-08T20:00:00Z'); // 23:00 Kampala, 8 Oct
    const end = studyDay('2026-10-08T23:30:00Z'); // 02:30 Kampala, 9 Oct
    expect(start).toBe('2026-10-08');
    expect(end).toBe('2026-10-08');
  });

  it('rolls over months and years', () => {
    expect(studyDay('2026-12-31T23:30:00Z')).toBe('2026-12-31'); // 02:30 on 1 Jan
    expect(studyDay('2027-01-01T00:30:00Z')).toBe('2027-01-01'); // 03:30 on 1 Jan
    expect(studyDay('2028-02-29T23:00:00Z')).toBe('2028-02-29'); // 02:00 on 1 Mar (leap year)
  });

  it('accepts a Date, an ISO string or epoch milliseconds', () => {
    const iso = '2026-10-09T00:01:00Z';
    expect(studyDay(new Date(iso))).toBe('2026-10-09');
    expect(studyDay(Date.parse(iso))).toBe('2026-10-09');
    expect(studyDay('2026-10-09T03:01:00+03:00')).toBe('2026-10-09');
  });
});

describe('studyDay — timezone behaviour', () => {
  // 01:30 UTC on 9 Oct 2026 is 04:30 in Kampala, 02:30 in London (BST) and 21:30 on 8 Oct in New York.
  const instant = '2026-10-09T01:30:00Z';

  it('gives the same instant different study days in different timezones', () => {
    expect(studyDay(instant, 'Africa/Kampala')).toBe('2026-10-09');
    expect(studyDay(instant, 'Europe/London')).toBe('2026-10-08');
    expect(studyDay(instant, 'America/New_York')).toBe('2026-10-08');
    expect(studyDay(instant, 'UTC')).toBe('2026-10-08');
  });

  it('applies the 02:59/03:01 edge in local time for other offsets', () => {
    // Asia/Kolkata is UTC+5:30.
    expect(studyDay('2026-10-08T21:29:00Z', 'Asia/Kolkata')).toBe('2026-10-08'); // 02:59
    expect(studyDay('2026-10-08T21:31:00Z', 'Asia/Kolkata')).toBe('2026-10-09'); // 03:01
    // America/New_York is UTC−4 in October.
    expect(studyDay('2026-10-09T06:59:00Z', 'America/New_York')).toBe('2026-10-08'); // 02:59
    expect(studyDay('2026-10-09T07:01:00Z', 'America/New_York')).toBe('2026-10-09'); // 03:01
  });

  it('rolls over at 03:00 local time on a daylight-saving change day', () => {
    // London springs forward on 29 Mar 2026: 01:00 GMT becomes 02:00 BST.
    expect(studyDay('2026-03-29T01:59:00Z', 'Europe/London')).toBe('2026-03-28'); // 02:59 BST
    expect(studyDay('2026-03-29T02:01:00Z', 'Europe/London')).toBe('2026-03-29'); // 03:01 BST
    // London falls back on 25 Oct 2026: 02:00 BST becomes 01:00 GMT.
    expect(studyDay('2026-10-25T02:59:00Z', 'Europe/London')).toBe('2026-10-24'); // 02:59 GMT
    expect(studyDay('2026-10-25T03:01:00Z', 'Europe/London')).toBe('2026-10-25'); // 03:01 GMT
  });

  it('rejects an unknown timezone and an invalid date', () => {
    expect(() => studyDay(instant, 'Mars/Olympus_Mons')).toThrow(RangeError);
    expect(() => studyDay('not a date')).toThrow(RangeError);
  });
});

describe('studyDayStart / studyDayEnd', () => {
  it('returns 03:00 local time as a UTC instant', () => {
    expect(studyDayStart('2026-10-09')).toBe('2026-10-09T00:00:00.000Z');
    expect(studyDayStart('2026-10-09', 'Europe/London')).toBe('2026-10-09T02:00:00.000Z');
  });

  it('ends where the next study day starts', () => {
    expect(studyDayEnd('2026-10-09')).toBe('2026-10-10T00:00:00.000Z');
  });

  it('round-trips with studyDay', () => {
    for (const tz of ['Africa/Kampala', 'Europe/London', 'America/New_York']) {
      const start = studyDayStart('2026-03-29', tz);
      expect(studyDay(start, tz)).toBe('2026-03-29');
      expect(studyDay(Date.parse(start) - 1, tz)).toBe('2026-03-28');
    }
  });
});

describe('clock helpers', () => {
  const clock = () => new Date('2026-10-08T23:59:00Z'); // 02:59 in Kampala

  it('reads the injected clock', () => {
    expect(nowIso(clock)).toBe('2026-10-08T23:59:00.000Z');
    expect(currentStudyDay('Africa/Kampala', clock)).toBe('2026-10-08');
  });

  it('formats instants as ISO-8601 UTC', () => {
    expect(toIso('2026-10-09T03:00:00+03:00')).toBe('2026-10-09T00:00:00.000Z');
    expect(toIso(0)).toBe('1970-01-01T00:00:00.000Z');
  });

  it('gives the plain calendar date with localDate (no rollover)', () => {
    expect(localDate('2026-10-08T23:59:00Z', 'Africa/Kampala')).toBe('2026-10-09');
  });
});

describe('day helpers', () => {
  it('adds and subtracts days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-10-01', '2026-10-09')).toBe(8);
    expect(daysBetween('2026-10-09', '2026-10-01')).toBe(-8);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('lists a range of days, both ends included', () => {
    expect(dayRange('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
    expect(dayRange('2026-10-09', '2026-10-09')).toEqual(['2026-10-09']);
    expect(dayRange('2026-10-09', '2026-10-08')).toEqual([]);
  });

  it('gives the day of the week', () => {
    expect(dayOfWeek('2026-10-09')).toBe(5); // Friday
    expect(dayOfWeek('2026-10-11')).toBe(0); // Sunday
  });

  it('validates day strings and timezones', () => {
    expect(isDayString('2026-10-09')).toBe(true);
    expect(isDayString('2026-02-30')).toBe(false);
    expect(isDayString('2026-10-9')).toBe(false);
    expect(isValidTimeZone('Africa/Kampala')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(() => addDays('9 Oct', 1)).toThrow(RangeError);
  });
});
