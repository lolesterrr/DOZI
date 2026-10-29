import { addDays, dayRange, studyDay, type DayString } from '@/lib/time';

import { calculateStreak, MAX_FREEZES } from '../streak';

const start = '2026-09-01';
const d = (offset: number): DayString => addDays(start, offset);

/** XP by day for the given offsets from `start` (10 XP each unless an amount is given). */
function days(offsets: number[], xp = 10): Record<DayString, number> {
  return Object.fromEntries(offsets.map((o) => [d(o), xp]));
}
const run = (from: number, to: number) => dayRange(d(from), d(to)).map((_, i) => from + i);

const streak = (xpByDay: Record<DayString, number>, today: number, dailyGoal = 50) =>
  calculateStreak({ xpByDay, today: d(today), dailyGoal });

describe('counting days', () => {
  it('has no streak without any XP', () => {
    expect(streak({}, 5)).toMatchObject({
      current: 0,
      longest: 0,
      todayCounted: false,
      atRisk: false,
      freezesHeld: 0,
      repair: null,
    });
  });

  it('counts a day only from 10 XP', () => {
    expect(streak({ [d(0)]: 9 }, 0).current).toBe(0);
    expect(streak({ [d(0)]: 10 }, 0)).toMatchObject({ current: 1, todayCounted: true });
  });

  it('adds up days in a row, today included once it counts', () => {
    const result = streak(days(run(0, 4)), 4);
    expect(result).toMatchObject({ current: 5, longest: 5, todayCounted: true, atRisk: false });
    expect(result.lastCountedDay).toBe(d(4));
  });

  it('keeps the streak alive but "at risk" while today has not counted yet', () => {
    const result = streak(days(run(0, 3)), 4);
    expect(result).toMatchObject({ current: 4, todayCounted: false, atRisk: true });
    // Some XP, but not enough yet.
    expect(streak({ ...days(run(0, 3)), [d(4)]: 6 }, 4)).toMatchObject({
      current: 4,
      atRisk: true,
    });
  });

  it('ignores days after today', () => {
    expect(streak(days([0, 1, 2]), 1).current).toBe(2);
  });
});

describe('a missed day', () => {
  it('breaks the streak when no freeze is held, and remembers the longest', () => {
    // 4 days, miss day 4, today is day 5 (not counted yet).
    const result = streak(days(run(0, 3)), 5);
    expect(result).toMatchObject({ current: 0, longest: 4, atRisk: false, freezesHeld: 0 });
  });

  it('starts a fresh streak after a break', () => {
    const result = streak(days([...run(0, 3), ...run(6, 7)]), 7);
    expect(result).toMatchObject({ current: 2, longest: 4 });
  });

  it('does not count today as missed', () => {
    expect(streak(days(run(0, 3)), 4).current).toBe(4);
  });
});

describe('streak freezes', () => {
  it('earns one at the 7-day milestone and uses it automatically on a missed day', () => {
    const week = run(0, 6);
    expect(streak(days(week), 6)).toMatchObject({ current: 7, freezesHeld: 1 });
    // Day 7 missed: the freeze covers it. Today (day 8) counts and the streak goes on.
    const result = streak(days([...week, 8]), 8);
    expect(result).toMatchObject({ current: 8, freezesHeld: 0, longest: 8 });
    expect(result.frozenDays).toEqual([d(7)]);
  });

  it('keeps the streak alive across a frozen day while today is still open', () => {
    const result = streak(days(run(0, 6)), 8);
    expect(result).toMatchObject({ current: 7, freezesHeld: 0, atRisk: true });
    expect(result.frozenDays).toEqual([d(7)]);
  });

  it('breaks the streak when the freeze is used up', () => {
    // 7 days, miss 7 (freeze), miss 8 (nothing left), today is day 9.
    const result = streak(days(run(0, 6)), 9);
    expect(result).toMatchObject({ current: 0, longest: 7 });
  });

  it('holds at most 2 freezes', () => {
    // 21 days = three milestones, but only 2 can be held.
    expect(streak(days(run(0, 20)), 20)).toMatchObject({ current: 21, freezesHeld: MAX_FREEZES });
  });

  it('earns a new freeze at every 7 days, also after using one', () => {
    // 7 days, a frozen day (it adds nothing), then 7 more counted days: 14 gives another freeze.
    const result = streak(days([...run(0, 6), ...run(8, 14)]), 14);
    expect(result).toMatchObject({ current: 14, freezesHeld: 1 });
    expect(result.frozenDays).toEqual([d(7)]);
  });

  it('never uses a freeze when there is no streak to protect', () => {
    expect(streak(days([0]), 6)).toMatchObject({ current: 0, freezesHeld: 0, frozenDays: [] });
  });

  it('can cover two missed days in a row with two freezes', () => {
    const result = streak(days([...run(0, 13), ...run(16, 17)]), 17);
    expect(result.frozenDays).toEqual([d(14), d(15)]);
    expect(result).toMatchObject({ current: 16, freezesHeld: 0 });
  });
});

describe('streak repair', () => {
  // 3 days (0–2), day 3 missed, so the break is on day 3 and the window is days 4 and 5.
  const broken = days(run(0, 2));

  it('is offered for 48 hours after a break, with how much is left to earn', () => {
    const result = streak({ ...broken, [d(4)]: 30 }, 4);
    expect(result.repair).toEqual({
      brokenDay: d(3),
      lostStreak: 3,
      until: d(5),
      earned: 30,
      target: 100,
    });
    expect(result.current).toBe(1); // today has 30 XP, so a new 1-day streak has started
  });

  it('brings the streak back when 2 × the goal is earned in the window', () => {
    const result = streak({ ...broken, [d(4)]: 60, [d(5)]: 40 }, 5);
    // Missed day filled in: 3 lost days + the 2 counted since.
    expect(result).toMatchObject({ current: 5, longest: 5, repair: null, lastRepairDay: d(5) });
    expect(result.repairedBreaks).toEqual([d(3)]);
  });

  it('can be finished in one day', () => {
    const result = streak({ ...broken, [d(4)]: 100 }, 4);
    expect(result).toMatchObject({ current: 4, repair: null });
  });

  it('is still open on the last day of the window, and gone the day after', () => {
    const base = { ...broken, [d(4)]: 20 };
    expect(streak(base, 5).repair).toMatchObject({ until: d(5), earned: 20 });
    expect(streak(base, 6).repair).toBeNull();
    expect(streak(base, 6).current).toBe(0);
  });

  it('does not count XP earned after the window', () => {
    const result = streak({ ...broken, [d(4)]: 60, [d(6)]: 90 }, 6);
    expect(result.repair).toBeNull();
    expect(result.current).toBe(1);
    expect(result.longest).toBe(3);
  });

  it('is allowed once every 30 days', () => {
    // Break on day 3, repaired on day 4 (the streak is 4 again), then nothing on day 5: a second
    // break only 2 days after the repair. Finishing its window is not allowed.
    const repaired = { ...broken, [d(4)]: 100, [d(6)]: 100 };
    const blocked = streak(repaired, 6);
    expect(blocked.repair).toBeNull();
    expect(blocked.current).toBe(1);
    expect(blocked.repairedBreaks).toEqual([d(3)]);

    // A new run on days 40–42 and a break on day 43, 39 days after the repair: allowed again.
    const later = { ...broken, [d(4)]: 100, ...days(run(40, 42)), [d(44)]: 100 };
    const allowed = streak(later, 44);
    expect(allowed.repair).toBeNull();
    expect(allowed.repairedBreaks).toEqual([d(3), d(43)]);
    expect(allowed.current).toBe(4); // 3 restored + day 44
  });

  it('is not offered when the goal is switched off', () => {
    expect(streak({ ...broken, [d(4)]: 500 }, 4, 0).repair).toBeNull();
  });

  it('keeps the first break when a second miss happens inside the window', () => {
    // Break on 3, counted on 4 (small run), missed on 5, today is 5: still the first break.
    const result = streak({ ...broken, [d(4)]: 10 }, 5);
    expect(result.repair).toMatchObject({ brokenDay: d(3), lostStreak: 3 });
  });

  it('does not earn a freeze twice for the same milestone', () => {
    // 7-day streak earns a freeze, uses it on day 7, breaks on 8, repairs on 9–10.
    const sevenDays = days(run(0, 6));
    const result = streak({ ...sevenDays, [d(9)]: 100 }, 9);
    expect(result.current).toBe(8); // 7 restored + day 9 counted
    expect(result.freezesHeld).toBe(0);
  });
});

describe('time travel: the 03:00 study-day rollover', () => {
  const kampala = 'Africa/Kampala';
  // XP earned at these instants (Kampala is UTC+3).
  const xpAt = (instants: string[]) => {
    const byDay: Record<DayString, number> = {};
    for (const at of instants)
      byDay[studyDay(at, kampala)] = (byDay[studyDay(at, kampala)] ?? 0) + 10;
    return byDay;
  };

  it('counts study at 02:59 for the day before and at 03:01 for the new day', () => {
    // Oct 1 at 02:59 local = Sep 30 23:59 UTC → study day Sep 30; Oct 1 at 03:01 → Oct 1.
    const xpByDay = xpAt(['2026-09-30T23:59:00.000Z', '2026-10-01T00:01:00.000Z']);
    expect(Object.keys(xpByDay).sort()).toEqual(['2026-09-30', '2026-10-01']);
    expect(calculateStreak({ xpByDay, today: '2026-10-01', dailyGoal: 50 }).current).toBe(2);
  });

  it('keeps a late-night session on the same day as the evening before', () => {
    // 21:00 and 01:30 (next morning) are one study day: only one day counts.
    const xpByDay = xpAt(['2026-10-01T18:00:00.000Z', '2026-10-01T22:30:00.000Z']);
    expect(Object.keys(xpByDay)).toEqual(['2026-10-01']);
    expect(calculateStreak({ xpByDay, today: '2026-10-01', dailyGoal: 50 }).current).toBe(1);
  });

  it('does not call yesterday missed until the new study day has started', () => {
    // Studied on Oct 1 only. At 02:00 on Oct 3 (still study day Oct 2) the streak is at risk,
    // not broken; Oct 2 is not over.
    const xpByDay = xpAt(['2026-10-01T12:00:00.000Z']);
    const today = studyDay('2026-10-02T23:00:00.000Z', kampala); // 02:00 Oct 3 local
    expect(today).toBe('2026-10-02');
    expect(calculateStreak({ xpByDay, today, dailyGoal: 50 })).toMatchObject({
      current: 1,
      atRisk: true,
    });
    // At 03:00 on Oct 3 the new study day starts, so Oct 2 has been missed: no freeze, so broken.
    const later = studyDay('2026-10-03T00:00:00.000Z', kampala);
    expect(later).toBe('2026-10-03');
    expect(calculateStreak({ xpByDay, today: later, dailyGoal: 50 }).current).toBe(0);
  });
});
