import {
  accuracyByType,
  barFraction,
  buildStats,
  dailySeries,
  deckStats,
  formatStudyTime,
  heatLevel,
  heatmapWeeks,
  MAX_REVIEW_MS,
  percentOf,
  reviewForecast,
  reviewTotals,
  type StatsData,
} from '../logic';

const TZ = 'Africa/Kampala';
// 2026-10-29 is a Thursday. Times below are UTC; Kampala is UTC+3.
const TODAY = '2026-10-29';

describe('percentOf', () => {
  it('rounds and returns null for nothing', () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(0, 0)).toBeNull();
  });
});

describe('heatLevel', () => {
  it.each([
    [0, 50, 0],
    [5, 50, 1],
    [20, 50, 2],
    [30, 50, 3],
    [50, 50, 4],
    [90, 50, 4],
    [5, 0, 2],
  ])('%i XP with goal %i is level %i', (xp, goal, level) => {
    expect(heatLevel(xp, goal)).toBe(level);
  });
});

describe('heatmapWeeks', () => {
  it('makes weeks of seven days, Monday first, ending with the week of today', () => {
    const grid = heatmapWeeks({ [TODAY]: 60, '2026-10-26': 10 }, TODAY, 50, 3);
    expect(grid).toHaveLength(3);
    for (const week of grid) expect(week).toHaveLength(7);
    const last = grid[2];
    expect(last[0].day).toBe('2026-10-26'); // Monday
    expect(last[3]).toMatchObject({ day: TODAY, level: 4, xp: 60, future: false });
    expect(last[4].future).toBe(true); // Friday hasn't happened
    expect(last[0].level).toBe(1);
    expect(grid[0][0].day).toBe('2026-10-12');
  });
});

describe('dailySeries', () => {
  it('lists the last days oldest first, filling gaps with 0', () => {
    const s = dailySeries({ [TODAY]: 7, '2026-10-27': 3 }, TODAY, 4);
    expect(s.map((d) => d.day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', TODAY]);
    expect(s.map((d) => d.value)).toEqual([0, 3, 0, 7]);
  });
});

describe('reviewTotals', () => {
  const r = (at: string, rating: number, durationMs: number | null = 5000) => ({
    at,
    rating,
    durationMs,
    deckId: 'd1',
  });

  it('counts today, the last 7 days and everything, with time and a remembered share', () => {
    const t = reviewTotals(
      [
        r('2026-10-29T08:00:00Z', 3),
        r('2026-10-29T09:00:00Z', 1),
        r('2026-10-25T09:00:00Z', 4), // 4 days ago
        r('2026-10-10T09:00:00Z', 2), // older
      ],
      TODAY,
      TZ,
    );
    expect(t).toMatchObject({ total: 4, today: 2, last7: 3, rememberedPercent: 75 });
    expect(t.timeMs).toBe(20000);
    expect(t.timeMsToday).toBe(10000);
    expect(t.timeMsLast7).toBe(15000);
  });

  it('uses the study day: 01:00 local still belongs to the day before', () => {
    // 2026-10-29T22:30Z is 01:30 on the 30th in Kampala, which is still study day the 29th.
    const t = reviewTotals([r('2026-10-29T22:30:00Z', 3)], TODAY, TZ);
    expect(t.today).toBe(1);
  });

  it('caps a very long answer and ignores missing times', () => {
    const t = reviewTotals(
      [r('2026-10-29T08:00:00Z', 3, 10 * 60_000), r('2026-10-29T08:01:00Z', 3, null)],
      TODAY,
      TZ,
    );
    expect(t.timeMs).toBe(MAX_REVIEW_MS);
  });

  it('has no remembered share without reviews', () => {
    expect(reviewTotals([], TODAY, TZ).rememberedPercent).toBeNull();
  });
});

describe('formatStudyTime', () => {
  it('rounds to minutes', () => {
    expect(formatStudyTime(0)).toEqual({ hours: 0, minutes: 0 });
    expect(formatStudyTime(65 * 60_000)).toEqual({ hours: 1, minutes: 5 });
    expect(formatStudyTime(29_000)).toEqual({ hours: 0, minutes: 0 });
  });
});

describe('reviewForecast', () => {
  it('counts cards per day, folding overdue ones into today and ignoring far-off ones', () => {
    const f = reviewForecast(
      [
        '2026-10-20T10:00:00Z', // overdue
        '2026-10-29T15:00:00Z', // today
        '2026-10-30T09:00:00Z', // tomorrow
        '2026-10-30T10:00:00Z', // tomorrow
        '2026-12-30T10:00:00Z', // too far
      ],
      TODAY,
      TZ,
      30,
    );
    expect(f.days).toHaveLength(30);
    expect(f.days[0]).toEqual({ day: TODAY, value: 2 });
    expect(f.days[1].value).toBe(2);
    expect(f.overdue).toBe(1);
    expect(f.total).toBe(4);
  });
});

describe('accuracyByType', () => {
  it('adds up points per type, busiest type first', () => {
    const rows = [
      { type: 'sba', score: 1, maxScore: 1, timeMs: 0 },
      { type: 'sba', score: 0, maxScore: 1, timeMs: 0 },
      { type: 'mtf', score: 3, maxScore: 5, timeMs: 0 },
      { type: 'sba', score: 1, maxScore: 1, timeMs: 0 },
    ];
    expect(accuracyByType(rows)).toEqual([
      { type: 'sba', answered: 3, percent: 67 },
      { type: 'mtf', answered: 1, percent: 60 },
    ]);
  });

  it('copes with questions worth nothing', () => {
    expect(
      accuracyByType([{ type: 'saq', score: 0, maxScore: 0, timeMs: 0 }])[0].percent,
    ).toBeNull();
  });
});

describe('deckStats', () => {
  it('summarises each deck, busiest first, with cards due now', () => {
    const now = '2026-10-29T12:00:00Z';
    const out = deckStats(
      [
        { id: 'a', title: 'Antibiotics', cards: 10 },
        { id: 'b', title: 'ANS', cards: 4 },
        { id: 'c', title: 'Empty', cards: 0 },
      ],
      [
        { at: now, rating: 3, durationMs: null, deckId: 'b' },
        { at: now, rating: 1, durationMs: null, deckId: 'b' },
        { at: now, rating: 3, durationMs: null, deckId: 'a' },
      ],
      [
        { deckId: 'a', due: '2026-10-29T11:00:00Z' },
        { deckId: 'a', due: '2026-10-30T11:00:00Z' },
      ],
      now,
    );
    expect(out.map((d) => d.id)).toEqual(['b', 'a', 'c']);
    expect(out[0]).toMatchObject({ reviews: 2, rememberedPercent: 50, due: 0 });
    expect(out[1]).toMatchObject({ reviews: 1, rememberedPercent: 100, due: 1 });
    expect(out[2].rememberedPercent).toBeNull();
  });
});

describe('barFraction', () => {
  it('scales to the tallest and keeps a sliver for small values', () => {
    expect(barFraction(0, 10)).toBe(0);
    expect(barFraction(10, 10)).toBe(1);
    expect(barFraction(5, 10)).toBe(0.5);
    expect(barFraction(1, 1000)).toBe(0.04);
    expect(barFraction(3, 0)).toBe(0);
  });
});

describe('buildStats', () => {
  const empty: StatsData = {
    now: '2026-10-29T12:00:00Z',
    today: TODAY,
    timeZone: TZ,
    goal: 50,
    xpByDay: {},
    reviews: [],
    due: [],
    quiz: [],
    decks: [],
  };

  it('is empty for a new student', () => {
    expect(buildStats(empty).empty).toBe(true);
  });

  it('adds quiz time to review time and is no longer empty', () => {
    const view = buildStats({
      ...empty,
      xpByDay: { [TODAY]: 12 },
      reviews: [{ at: '2026-10-29T08:00:00Z', rating: 3, durationMs: 60000, deckId: 'd' }],
      quiz: [{ type: 'sba', score: 1, maxScore: 1, timeMs: 30000 }],
    });
    expect(view.empty).toBe(false);
    expect(view.timeMs).toBe(90000);
    expect(view.activeDays).toBe(1);
    expect(view.xpTotal14).toBe(12);
    expect(view.quizAnswered).toBe(1);
  });
});
