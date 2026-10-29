import {
  dailyGoalProgress,
  goalXp,
  isValidDailyGoal,
  levelForXp,
  levelProgress,
  MAX_LEVEL,
  planAward,
  titleForLevel,
  xpForLevel,
  xpRules,
  type PlanAwardInput,
  type XpEventLike,
} from '../logic';

const day = '2026-10-29';
const ev = (source: XpEventLike['source'], amount: number, sourceId: string | null = null) => ({
  source,
  sourceId,
  amount,
});

const base: PlanAwardInput = {
  source: 'review_card',
  sourceId: 'i1',
  today: [],
  everAwarded: false,
  day,
  dailyGoal: 50,
};

describe('XP rules table (PRODUCT_SPEC §8.1)', () => {
  it('has the documented amounts', () => {
    const amounts = Object.fromEntries(Object.entries(xpRules).map(([k, r]) => [k, r.amount]));
    expect(amounts).toMatchObject({
      review_card: 1,
      quiz_correct_own: 1,
      quiz_correct_official: 2,
      lesson_complete: 10,
      lesson_all_correct: 5,
      practice_node: 10,
      checkpoint_pass: 25,
      checkpoint_three_stars: 10,
      mock_exam: 50,
      card_created: 1,
      note_created: 2,
      daily_goal_bonus: 5,
      error_report_accepted: 20,
    });
    expect(xpRules.card_created.dailyCap).toBe(20);
    expect(xpRules.note_created.dailyCap).toBe(10);
  });
});

describe('planAward', () => {
  it('gives a card review 1 XP, once per card per study day', () => {
    expect(planAward(base)).toMatchObject({ total: 1, events: [{ amount: 1, sourceId: 'i1' }] });
    const again = planAward({ ...base, today: [ev('review_card', 1, 'i1')] });
    expect(again.total).toBe(0);
    expect(again.events).toEqual([]);
    // A different card the same day still counts.
    expect(planAward({ ...base, today: [ev('review_card', 1, 'i1')], sourceId: 'i2' }).total).toBe(
      1,
    );
  });

  it('pays a "once" award only the first time ever', () => {
    const input = { ...base, source: 'note_created' as const, sourceId: 'n1' };
    expect(planAward(input).total).toBe(2);
    expect(planAward({ ...input, everAwarded: true }).total).toBe(0);
  });

  it('multiplies by the count (correct answers in one quiz attempt)', () => {
    expect(planAward({ ...base, source: 'quiz_correct_own', sourceId: 'a1', count: 7 }).total).toBe(
      7,
    );
    expect(
      planAward({ ...base, source: 'quiz_correct_official', sourceId: 'a1', count: 3 }).total,
    ).toBe(6);
    expect(planAward({ ...base, source: 'quiz_correct_own', count: 0 }).total).toBe(0);
  });

  it('stops creating-a-card XP at 20 a day, giving only what is left under the cap', () => {
    const input = { ...base, source: 'card_created' as const, sourceId: 'c-new' };
    const earned = (n: number) => [ev('card_created', n, 'earlier')];
    expect(planAward({ ...input, today: earned(19) }).total).toBe(1);
    expect(planAward({ ...input, today: earned(20) }).total).toBe(0);
    expect(planAward({ ...input, today: earned(20) }).events).toEqual([]);
    expect(planAward({ ...input, today: earned(18), count: 5 }).total).toBe(2);
  });

  it('stops note XP at 10 a day', () => {
    const input = { ...base, source: 'note_created' as const, sourceId: 'n9' };
    expect(planAward({ ...input, today: [ev('note_created', 10, 'n1')] }).total).toBe(0);
    expect(planAward({ ...input, today: [ev('note_created', 8, 'n1')] }).total).toBe(2);
  });

  it('adds the 5 XP goal bonus when the day first reaches the goal', () => {
    const today = [ev('review_card', 49, 'many')];
    const plan = planAward({ ...base, today });
    expect(plan.goalReached).toBe(true);
    expect(plan.total).toBe(6);
    expect(plan.events).toEqual([
      { source: 'review_card', sourceId: 'i1', amount: 1 },
      { source: 'daily_goal_bonus', sourceId: day, amount: 5 },
    ]);
  });

  it('gives the goal bonus only once a day, and not before the goal', () => {
    expect(planAward({ ...base, today: [ev('review_card', 10, 'x')] }).goalReached).toBe(false);
    const done = [ev('review_card', 50, 'x'), ev('daily_goal_bonus', 5, day)];
    const plan = planAward({ ...base, today: done });
    expect(plan.goalReached).toBe(false);
    expect(plan.events).toHaveLength(1);
  });

  it('counts a big award that jumps over the goal, and ignores the bonus itself', () => {
    const plan = planAward({
      ...base,
      source: 'mock_exam',
      sourceId: 'm1',
      today: [ev('review_card', 10, 'x')],
    });
    expect(plan.goalReached).toBe(true);
    expect(plan.total).toBe(55);
  });

  it('has no bonus when the goal is switched off', () => {
    expect(
      planAward({ ...base, dailyGoal: 0, source: 'mock_exam', sourceId: 'm1' }).goalReached,
    ).toBe(false);
  });
});

describe('daily goal progress', () => {
  it('shows the share done and what is left', () => {
    expect(dailyGoalProgress(20, 50)).toEqual({
      xp: 20,
      goal: 50,
      fraction: 0.4,
      met: false,
      remaining: 30,
    });
    expect(dailyGoalProgress(80, 50)).toMatchObject({ fraction: 1, met: true, remaining: 0 });
    expect(dailyGoalProgress(5, 0)).toMatchObject({ goal: 0, fraction: 0, met: false });
  });

  it('leaves the bonus out of the goal', () => {
    expect(goalXp([ev('review_card', 4), ev('daily_goal_bonus', 5, day)])).toBe(4);
  });

  it('accepts goals from 10 to 500', () => {
    expect([9, 10, 50, 500, 501, 12.5].map(isValidDailyGoal)).toEqual([
      false,
      true,
      true,
      true,
      false,
      false,
    ]);
  });
});

describe('levels (PRODUCT_SPEC §8.3)', () => {
  it('follows 40 × (n − 1)^1.6, starting at 0 XP', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(40);
    expect(xpForLevel(3)).toBe(Math.round(40 * 2 ** 1.6));
    expect(xpForLevel(MAX_LEVEL)).toBe(Math.round(40 * 49 ** 1.6));
  });

  it('finds the level for any total, from 1 to 50', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(39)).toBe(1);
    expect(levelForXp(40)).toBe(2);
    expect(levelForXp(xpForLevel(10) - 1)).toBe(9);
    expect(levelForXp(xpForLevel(10))).toBe(10);
    expect(levelForXp(10_000_000)).toBe(MAX_LEVEL);
    expect(levelForXp(-5)).toBe(1);
  });

  it('gets steadily harder', () => {
    const gaps = Array.from(
      { length: MAX_LEVEL - 1 },
      (_, i) => xpForLevel(i + 2) - xpForLevel(i + 1),
    );
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1]);
  });

  it('gives a new title every 5 levels', () => {
    expect([1, 4, 5, 9, 10, 15, 20, 24, 25, 50].map(titleForLevel)).toEqual([
      'intern',
      'intern',
      'dispenser',
      'dispenser',
      'compounder',
      'pharmacologist',
      'clinicalPharmacist',
      'clinicalPharmacist',
      'professor',
      'professor',
    ]);
  });

  it('reports progress through the current level', () => {
    expect(levelProgress(0)).toMatchObject({
      level: 1,
      xpIntoLevel: 0,
      xpForNext: 40,
      fraction: 0,
    });
    expect(levelProgress(20)).toMatchObject({ level: 1, xpIntoLevel: 20, fraction: 0.5 });
    const second = levelProgress(40 + 10);
    expect(second).toMatchObject({ level: 2, xpIntoLevel: 10 });
    expect(second.xpForNext).toBe(xpForLevel(3) - 40);
    expect(levelProgress(1_000_000)).toMatchObject({ level: 50, maxed: true, fraction: 1 });
  });
});
