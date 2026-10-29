import type { AchievementKey } from './achievements';
import type { AwardResult } from './repo';

/** An XP award plus any badges earned along with it. */
export type AwardOutcome = AwardResult & { badges?: readonly AchievementKey[] };

// Pure rules for what the session-end screen celebrates (task 2.5): the XP earned during the
// session and which big moments happened along the way. No React, no database.

export type Celebration = {
  /** XP earned in the session, goal bonus included. */
  xp: number;
  goalReached: boolean;
  /** The last level reached, when the session took the student up. */
  levelUp: { from: number; to: number } | null;
  streakExtended: boolean;
  streakRepaired: boolean;
  /** Streak length after the last award that changed it (null when nothing changed). */
  streakDays: number | null;
  /** Badges earned during the session. */
  badges: AchievementKey[];
};

export const noCelebration: Celebration = {
  xp: 0,
  goalReached: false,
  levelUp: null,
  streakExtended: false,
  streakRepaired: false,
  streakDays: null,
  badges: [],
};

/** Adds up a session's awards, in the order they were given. */
export function summariseAwards(results: readonly AwardOutcome[]): Celebration {
  let out = noCelebration;
  for (const r of results) {
    out = {
      xp: out.xp + r.xp,
      goalReached: out.goalReached || r.goalReached,
      // A session can cross two levels: show from where it began to where it ended.
      levelUp: r.levelUp
        ? { from: out.levelUp?.from ?? r.levelUp.from, to: r.levelUp.to }
        : out.levelUp,
      streakExtended: out.streakExtended || r.streakExtended,
      streakRepaired: out.streakRepaired || r.streakRepaired,
      badges: [...out.badges, ...(r.badges ?? [])],
      streakDays:
        r.streakExtended || r.streakRepaired
          ? (r.streak?.current ?? out.streakDays)
          : out.streakDays,
    };
  }
  return out;
}

/** True when the session deserves confetti: a new level, the daily goal, or a streak moment. */
export function isBigMoment(c: Celebration): boolean {
  return (
    c.badges.length > 0 || !!c.levelUp || c.goalReached || c.streakExtended || c.streakRepaired
  );
}
