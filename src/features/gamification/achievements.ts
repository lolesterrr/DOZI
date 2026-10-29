import { localDate, localHour, DEFAULT_TIMEZONE, STUDY_DAY_ROLLOVER_HOUR } from '@/lib/time';

// Badges and their unlock rules (PRODUCT_SPEC §8.4). Pure: the repo gathers the numbers
// (`AchievementStats`), this says which badges they unlock. Names and hints are in
// strings.achievements.items. Badges that depend on features not built yet (topic mastery,
// calculation problems) are listed with `rule: null`: they show as locked, "coming later".

export const achievementKeys = [
  'first_dose',
  'card_collector',
  'note_taker',
  'diagram_master',
  'week_warrior',
  'unbreakable',
  'century',
  'perfect_checkpoint',
  'topic_mastered',
  'ans_ace',
  'antimicrobial_guardian',
  'pk_pro',
  'mock_survivor',
  'sharp_eye',
  'early_bird',
] as const;
export type AchievementKey = (typeof achievementKeys)[number];

/** Everything the rules look at. Gathered from the local database by `repo.ts`. */
export type AchievementStats = {
  lessonsCompleted: number;
  cardsCreated: number;
  notesCreated: number;
  occlusionCards: number;
  /** The longest streak ever (days). */
  longestStreak: number;
  /** Different days with a review between 03:00 and 08:00. */
  earlyBirdDays: number;
  /** Checkpoints finished with three stars. */
  perfectCheckpoints: number;
  mockExams: number;
  acceptedReports: number;
};

export const noStats: AchievementStats = {
  lessonsCompleted: 0,
  cardsCreated: 0,
  notesCreated: 0,
  occlusionCards: 0,
  longestStreak: 0,
  earlyBirdDays: 0,
  perfectCheckpoints: 0,
  mockExams: 0,
  acceptedReports: 0,
};

export type AchievementDef = {
  key: AchievementKey;
  /** How far along the student is (`value` of `target`), or null when it can't be measured yet. */
  rule: { target: number; value: (stats: AchievementStats) => number } | null;
};

const count = (target: number, value: (s: AchievementStats) => number) => ({ target, value });

export const achievementDefs: readonly AchievementDef[] = [
  { key: 'first_dose', rule: count(1, (s) => s.lessonsCompleted) },
  { key: 'card_collector', rule: count(50, (s) => s.cardsCreated) },
  { key: 'note_taker', rule: count(10, (s) => s.notesCreated) },
  { key: 'diagram_master', rule: count(5, (s) => s.occlusionCards) },
  { key: 'week_warrior', rule: count(7, (s) => s.longestStreak) },
  { key: 'unbreakable', rule: count(30, (s) => s.longestStreak) },
  { key: 'century', rule: count(100, (s) => s.longestStreak) },
  { key: 'perfect_checkpoint', rule: count(1, (s) => s.perfectCheckpoints) },
  { key: 'topic_mastered', rule: null },
  { key: 'ans_ace', rule: null },
  { key: 'antimicrobial_guardian', rule: null },
  { key: 'pk_pro', rule: null },
  { key: 'mock_survivor', rule: count(1, (s) => s.mockExams) },
  { key: 'sharp_eye', rule: count(1, (s) => s.acceptedReports) },
  { key: 'early_bird', rule: count(5, (s) => s.earlyBirdDays) },
];

export type AchievementProgress = {
  key: AchievementKey;
  /** false for badges whose feature isn't built yet. */
  measurable: boolean;
  value: number;
  target: number;
  /** 0…1 */
  fraction: number;
  met: boolean;
};

/** Progress on every badge, in the order of `achievementDefs`. */
export function achievementProgress(stats: AchievementStats): AchievementProgress[] {
  return achievementDefs.map((def) => {
    if (!def.rule) {
      return { key: def.key, measurable: false, value: 0, target: 0, fraction: 0, met: false };
    }
    const value = Math.max(0, def.rule.value(stats));
    const { target } = def.rule;
    return {
      key: def.key,
      measurable: true,
      value: Math.min(value, target),
      target,
      fraction: Math.min(1, value / target),
      met: value >= target,
    };
  });
}

/** Badges the stats unlock that the student doesn't have yet. */
export function newlyUnlocked(
  stats: AchievementStats,
  unlocked: ReadonlySet<string>,
): AchievementKey[] {
  return achievementProgress(stats)
    .filter((p) => p.met && !unlocked.has(p.key))
    .map((p) => p.key);
}

/** Early Bird: study before this hour (local), but after the 03:00 study-day rollover. */
export const EARLY_BIRD_BEFORE_HOUR = 8;

/** How many different days have at least one review between 03:00 and 08:00 (local time). */
export function countEarlyBirdDays(
  reviewTimes: readonly string[],
  timeZone: string = DEFAULT_TIMEZONE,
): number {
  const days = new Set<string>();
  for (const time of reviewTimes) {
    const hour = localHour(time, timeZone);
    if (hour >= STUDY_DAY_ROLLOVER_HOUR && hour < EARLY_BIRD_BEFORE_HOUR) {
      days.add(localDate(time, timeZone));
    }
  }
  return days.size;
}
