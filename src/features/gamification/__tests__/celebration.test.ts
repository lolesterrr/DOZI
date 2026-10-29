import { isBigMoment, noCelebration, summariseAwards } from '../celebration';
import type { AwardResult } from '../repo';

const base: AwardResult = {
  events: [],
  xp: 0,
  goalReached: false,
  levelUp: null,
  streak: null,
  streakExtended: false,
  streakRepaired: false,
};
const award = (over: Partial<AwardResult>): AwardResult => ({ ...base, ...over });

describe('summariseAwards', () => {
  it('is empty for no awards', () => {
    expect(summariseAwards([])).toEqual(noCelebration);
    expect(isBigMoment(noCelebration)).toBe(false);
  });

  it('adds up XP and remembers the big moments', () => {
    const c = summariseAwards([
      award({ xp: 2 }),
      award({ xp: 7, goalReached: true }),
      award({ xp: 2 }),
    ]);
    expect(c.xp).toBe(11);
    expect(c.goalReached).toBe(true);
    expect(isBigMoment(c)).toBe(true);
  });

  it('shows a level-up from where the session began to where it ended', () => {
    const c = summariseAwards([
      award({ xp: 5, levelUp: { from: 2, to: 3 } }),
      award({ xp: 5, levelUp: { from: 3, to: 4 } }),
    ]);
    expect(c.levelUp).toEqual({ from: 2, to: 4 });
  });

  it('keeps the streak length from the award that changed it', () => {
    const streak = { current: 5 } as AwardResult['streak'];
    const c = summariseAwards([
      award({ xp: 10, streakExtended: true, streak }),
      award({ xp: 2, streak: { current: 5 } as AwardResult['streak'] }),
    ]);
    expect(c.streakExtended).toBe(true);
    expect(c.streakDays).toBe(5);
  });
});
