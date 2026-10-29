import {
  achievementDefs,
  achievementKeys,
  achievementProgress,
  countEarlyBirdDays,
  newlyUnlocked,
  noStats,
} from '../achievements';
import { strings } from '@/i18n/strings';

describe('achievement definitions', () => {
  it('has one definition and one set of words for every badge', () => {
    expect(achievementDefs.map((d) => d.key)).toEqual([...achievementKeys]);
    for (const key of achievementKeys) {
      expect(strings.achievements.items[key].name).not.toBe('');
      expect(strings.achievements.items[key].hint).not.toBe('');
    }
  });
});

describe('newlyUnlocked', () => {
  it('unlocks nothing for a new student', () => {
    expect(newlyUnlocked(noStats, new Set())).toEqual([]);
  });

  it.each([
    [{ cardsCreated: 49 }, 'card_collector', false],
    [{ cardsCreated: 50 }, 'card_collector', true],
    [{ notesCreated: 10 }, 'note_taker', true],
    [{ occlusionCards: 4 }, 'diagram_master', false],
    [{ occlusionCards: 5 }, 'diagram_master', true],
    [{ lessonsCompleted: 1 }, 'first_dose', true],
    [{ perfectCheckpoints: 1 }, 'perfect_checkpoint', true],
    [{ mockExams: 1 }, 'mock_survivor', true],
    [{ acceptedReports: 1 }, 'sharp_eye', true],
    [{ earlyBirdDays: 4 }, 'early_bird', false],
    [{ earlyBirdDays: 5 }, 'early_bird', true],
  ] as const)('%j → %s unlocked: %s', (change, key, unlocked) => {
    expect(newlyUnlocked({ ...noStats, ...change }, new Set()).includes(key)).toBe(unlocked);
  });

  it('unlocks the streak badges one by one', () => {
    expect(newlyUnlocked({ ...noStats, longestStreak: 7 }, new Set())).toEqual(['week_warrior']);
    expect(newlyUnlocked({ ...noStats, longestStreak: 30 }, new Set())).toEqual([
      'week_warrior',
      'unbreakable',
    ]);
    expect(newlyUnlocked({ ...noStats, longestStreak: 100 }, new Set())).toHaveLength(3);
  });

  it('skips badges already earned', () => {
    const stats = { ...noStats, longestStreak: 30 };
    expect(newlyUnlocked(stats, new Set(['week_warrior']))).toEqual(['unbreakable']);
  });

  it('never unlocks badges that need features not built yet', () => {
    const everything = Object.fromEntries(Object.keys(noStats).map((k) => [k, 1000]));
    const keys = newlyUnlocked(everything as typeof noStats, new Set());
    for (const locked of ['topic_mastered', 'ans_ace', 'antimicrobial_guardian', 'pk_pro']) {
      expect(keys).not.toContain(locked);
    }
  });
});

describe('achievementProgress', () => {
  it('reports how far along each badge is, capped at the target', () => {
    const p = achievementProgress({ ...noStats, cardsCreated: 20, notesCreated: 99 });
    const cards = p.find((x) => x.key === 'card_collector');
    expect(cards).toMatchObject({ value: 20, target: 50, fraction: 0.4, met: false });
    expect(p.find((x) => x.key === 'note_taker')).toMatchObject({
      value: 10,
      fraction: 1,
      met: true,
    });
    expect(p.find((x) => x.key === 'pk_pro')).toMatchObject({ measurable: false, met: false });
  });
});

describe('countEarlyBirdDays', () => {
  it('counts different days with a review between 03:00 and 08:00 local time', () => {
    const times = [
      '2026-10-20T03:30:00Z', // 06:30 in Kampala (UTC+3)
      '2026-10-20T04:30:00Z', // same day again
      '2026-10-21T04:59:00Z', // 07:59
      '2026-10-22T05:00:00Z', // 08:00: too late
      '2026-10-23T00:30:00Z', // 03:30
      '2026-10-24T23:30:00Z', // 02:30 next morning: still last night's study day
      '2026-10-25T12:00:00Z', // midday
    ];
    expect(countEarlyBirdDays(times, 'Africa/Kampala')).toBe(3);
  });
});
