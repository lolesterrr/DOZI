import { chooseGreeting, dayNumber, mergeRecent, weekStrip, type GreetingInput } from '../logic';

const base: GreetingInput = {
  hour: 9,
  day: '2026-10-29',
  streakDays: 0,
  todayCounted: false,
  goalMet: false,
};

describe('chooseGreeting', () => {
  it('says hello for the time of day', () => {
    expect(chooseGreeting({ ...base, hour: 8 })).toMatchObject({
      context: 'greetingMorning',
      mood: 'happy',
    });
    expect(chooseGreeting({ ...base, hour: 14 }).context).toBe('greetingDay');
    expect(chooseGreeting({ ...base, hour: 19 }).context).toBe('greetingEvening');
  });

  it('is sleepy at night, in step with the quiet hours', () => {
    for (const hour of [22, 23, 0, 3, 4]) {
      expect(chooseGreeting({ ...base, hour })).toMatchObject({
        context: 'greetingLate',
        mood: 'sleepy',
      });
    }
    // Even with a streak to keep and a goal reached: no pressure at night.
    expect(chooseGreeting({ ...base, hour: 23, streakDays: 9, goalMet: true }).context).toBe(
      'greetingLate',
    );
  });

  it('celebrates a reached goal', () => {
    expect(chooseGreeting({ ...base, goalMet: true })).toMatchObject({
      context: 'goalReached',
      mood: 'celebrating',
    });
  });

  it('gently reminds about a streak worth keeping, only in the evening', () => {
    const streak = { ...base, hour: 18, streakDays: 5 };
    expect(chooseGreeting(streak)).toMatchObject({ context: 'streakAtRisk', mood: 'concerned' });
    expect(chooseGreeting({ ...streak, hour: 12 }).context).toBe('greetingDay'); // too early
    expect(chooseGreeting({ ...streak, todayCounted: true }).context).toBe('greetingEvening');
    expect(chooseGreeting({ ...streak, streakDays: 1 }).context).toBe('greetingEvening'); // short
  });

  it('picks the same line all day and another on another day', () => {
    const a = chooseGreeting(base);
    expect(chooseGreeting({ ...base, hour: 11 }).message).toBe(a.message);
    const messages = new Set(
      [0, 1, 2].map((i) => chooseGreeting({ ...base, day: `2026-10-${29 + i}` }).message),
    );
    expect(messages.size).toBe(3);
  });

  it('counts days from a fixed date', () => {
    expect(dayNumber('2026-01-01')).toBe(0);
    expect(dayNumber('2026-01-31')).toBe(30);
  });
});

describe('mergeRecent', () => {
  const item = (kind: 'note' | 'deck' | 'quiz', id: string, updatedAt: string) => ({
    kind,
    id,
    title: `SAMPLE ${id}`,
    updatedAt,
  });

  it('mixes the kinds, newest first, and keeps only the limit', () => {
    const merged = mergeRecent(
      [
        item('note', 'n1', '2026-10-29T10:00:00.000Z'),
        item('deck', 'd1', '2026-10-29T12:00:00.000Z'),
        item('quiz', 'q1', '2026-10-29T11:00:00.000Z'),
        item('note', 'n2', '2026-10-28T10:00:00.000Z'),
      ],
      3,
    );
    expect(merged.map((i) => i.id)).toEqual(['d1', 'q1', 'n1']);
  });

  it('breaks ties by id so the order never jumps, and handles nothing', () => {
    const same = '2026-10-29T10:00:00.000Z';
    expect(
      mergeRecent([item('deck', 'b', same), item('note', 'a', same)], 5).map((i) => i.id),
    ).toEqual(['a', 'b']);
    expect(mergeRecent([], 5)).toEqual([]);
    expect(mergeRecent([item('note', 'a', same)], 0)).toEqual([]);
  });
});

describe('weekStrip', () => {
  // 2026-11-05 is a Thursday.
  const xp = { '2026-11-02': 60, '2026-11-03': 25, '2026-11-05': 10, '2026-11-06': 99 };

  it('runs Monday to Sunday around today', () => {
    const week = weekStrip('2026-11-05', xp, 50);
    expect(week.map((d) => d.day)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
    expect(week.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(week[3]).toMatchObject({ date: 5, isToday: true, isFuture: false });
  });

  it('fills each day by its share of the goal, capped at full, and leaves the future empty', () => {
    const week = weekStrip('2026-11-05', xp, 50);
    expect(week.map((d) => d.fraction)).toEqual([1, 0.5, 0, 0.2, 0, 0, 0]);
    expect(week[4].isFuture).toBe(true);
  });

  it('treats Sunday as the last day of its week', () => {
    const week = weekStrip('2026-11-08', {}, 50);
    expect(week[0].day).toBe('2026-11-02');
    expect(week[6]).toMatchObject({ day: '2026-11-08', isToday: true });
  });

  it('counts any XP as a full day when there is no goal', () => {
    expect(weekStrip('2026-11-05', xp, 0)[1].fraction).toBe(1);
  });
});
