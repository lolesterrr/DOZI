import { addDays, dayOfWeek, daysBetween, studyDay, type DayString } from '@/lib/time';

// Pure rules for the Stats screen (PRODUCT_SPEC §8.5, task 2.7): turn the student's history
// into what the charts draw. No React and no database; `repo.ts` gathers the numbers.

/** One answer in a review session. */
export type ReviewSample = {
  /** ISO time of the answer. */
  at: string;
  /** 1 Again · 2 Hard · 3 Good · 4 Easy. */
  rating: number;
  durationMs: number | null;
  deckId: string;
};

/** One answered quiz question. */
export type QuizSample = {
  type: string;
  score: number;
  maxScore: number;
  timeMs: number;
};

/** A card waiting to be reviewed again. */
export type DueSample = { deckId: string; due: string };

export type DeckSample = { id: string; title: string; cards: number };

/** A review that took longer than this counts as this long (the phone was put down). */
export const MAX_REVIEW_MS = 120_000;

/** Percent of `part` in `whole`, rounded; null when there is nothing to measure. */
export function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** "Remembered" means any answer but Again, as on the session-end screen. */
export const isRemembered = (rating: number) => rating >= 2;

// ---------------------------------------------------------------------------------------------
// Heatmap

export type HeatCell = { day: DayString; level: 0 | 1 | 2 | 3 | 4; future: boolean; xp: number };

/** 0 = nothing · 1…4 = from a little up to the full daily goal (or more). */
export function heatLevel(xp: number, goal: number): HeatCell['level'] {
  if (xp <= 0) return 0;
  if (goal <= 0) return 2;
  const ratio = xp / goal;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 1) return 3;
  return 4;
}

/**
 * The activity grid: `weeks` columns of 7 days (Monday at the top), the last column holding
 * today. Days after today are marked `future` so the grid stays rectangular.
 */
export function heatmapWeeks(
  xpByDay: Record<DayString, number>,
  today: DayString,
  goal: number,
  weeks = 12,
): HeatCell[][] {
  const mondayOffset = (dayOfWeek(today) + 6) % 7; // 0 when today is Monday
  const lastMonday = addDays(today, -mondayOffset);
  const firstMonday = addDays(lastMonday, -7 * (Math.max(1, weeks) - 1));
  return Array.from({ length: Math.max(1, weeks) }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(firstMonday, w * 7 + d);
      const future = daysBetween(today, day) > 0;
      const xp = future ? 0 : (xpByDay[day] ?? 0);
      return { day, level: heatLevel(xp, goal), future, xp };
    }),
  );
}

/** Days with any XP among the visible cells. */
export function activeDays(grid: HeatCell[][]): number {
  return grid.flat().filter((c) => !c.future && c.xp > 0).length;
}

// ---------------------------------------------------------------------------------------------
// XP per day

export type DayValue = { day: DayString; value: number };

/** The last `days` study days, oldest first, today last. */
export function dailySeries(
  valueByDay: Record<DayString, number>,
  today: DayString,
  days = 14,
): DayValue[] {
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - (days - 1));
    return { day, value: valueByDay[day] ?? 0 };
  });
}

// ---------------------------------------------------------------------------------------------
// Reviews

export type ReviewTotals = {
  total: number;
  today: number;
  last7: number;
  /** Share of answers that were not "Again" (null with no reviews). */
  rememberedPercent: number | null;
  /** Time spent reviewing (each answer capped at MAX_REVIEW_MS), in ms. */
  timeMs: number;
  timeMsToday: number;
  timeMsLast7: number;
};

export function reviewsByDay(
  reviews: readonly ReviewSample[],
  timeZone: string,
): Record<DayString, number> {
  const out: Record<DayString, number> = {};
  for (const r of reviews) {
    const day = studyDay(r.at, timeZone);
    out[day] = (out[day] ?? 0) + 1;
  }
  return out;
}

export function reviewTotals(
  reviews: readonly ReviewSample[],
  today: DayString,
  timeZone: string,
): ReviewTotals {
  const totals: ReviewTotals = {
    total: reviews.length,
    today: 0,
    last7: 0,
    rememberedPercent: null,
    timeMs: 0,
    timeMsToday: 0,
    timeMsLast7: 0,
  };
  let remembered = 0;
  for (const r of reviews) {
    if (isRemembered(r.rating)) remembered++;
    const ms = Math.min(Math.max(0, r.durationMs ?? 0), MAX_REVIEW_MS);
    totals.timeMs += ms;
    const age = daysBetween(studyDay(r.at, timeZone), today);
    if (age === 0) {
      totals.today++;
      totals.timeMsToday += ms;
    }
    if (age >= 0 && age < 7) {
      totals.last7++;
      totals.timeMsLast7 += ms;
    }
  }
  totals.rememberedPercent = percentOf(remembered, reviews.length);
  return totals;
}

/** "1 h 5 min", "12 min", "<1 min" (never shows seconds). */
export function formatStudyTime(ms: number): { hours: number; minutes: number } {
  const totalMinutes = Math.round(Math.max(0, ms) / 60000);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

// ---------------------------------------------------------------------------------------------
// Forecast

export type Forecast = {
  /** Cards due on each of the next days; day 0 also holds everything overdue. */
  days: DayValue[];
  /** Due now or earlier. */
  overdue: number;
  /** Due within the window. */
  total: number;
};

/** How many cards come due on each of the next `days` study days (today first). */
export function reviewForecast(
  dueTimes: readonly string[],
  today: DayString,
  timeZone: string,
  days = 30,
): Forecast {
  const counts = new Array<number>(days).fill(0);
  let overdue = 0;
  for (const due of dueTimes) {
    const offset = daysBetween(today, studyDay(due, timeZone));
    if (offset < 0) overdue++;
    if (offset >= days) continue;
    counts[Math.max(0, offset)]++;
  }
  return {
    days: counts.map((value, i) => ({ day: addDays(today, i), value })),
    overdue,
    total: counts.reduce((a, b) => a + b, 0),
  };
}

// ---------------------------------------------------------------------------------------------
// Quizzes

export type TypeAccuracy = { type: string; answered: number; percent: number | null };

/** Points earned out of points possible, per question type (in the order types first appear). */
export function accuracyByType(rows: readonly QuizSample[]): TypeAccuracy[] {
  const byType = new Map<string, { answered: number; score: number; max: number }>();
  for (const r of rows) {
    const entry = byType.get(r.type) ?? { answered: 0, score: 0, max: 0 };
    entry.answered++;
    entry.score += r.score;
    entry.max += r.maxScore;
    byType.set(r.type, entry);
  }
  return [...byType.entries()]
    .map(([type, e]) => ({
      type,
      answered: e.answered,
      percent: percentOf(Math.max(0, e.score), e.max),
    }))
    .sort((a, b) => b.answered - a.answered);
}

export function quizTimeMs(rows: readonly QuizSample[]): number {
  return rows.reduce((sum, r) => sum + Math.max(0, r.timeMs), 0);
}

// ---------------------------------------------------------------------------------------------
// Decks

export type DeckStats = {
  id: string;
  title: string;
  cards: number;
  reviews: number;
  rememberedPercent: number | null;
  /** Cards due now. */
  due: number;
};

/** One row per deck, busiest first (decks with no activity last, then by title). */
export function deckStats(
  decks: readonly DeckSample[],
  reviews: readonly ReviewSample[],
  due: readonly DueSample[],
  now: string,
): DeckStats[] {
  const nowMs = Date.parse(now);
  return decks
    .map((deck) => {
      const mine = reviews.filter((r) => r.deckId === deck.id);
      return {
        id: deck.id,
        title: deck.title,
        cards: deck.cards,
        reviews: mine.length,
        rememberedPercent: percentOf(
          mine.filter((r) => isRemembered(r.rating)).length,
          mine.length,
        ),
        due: due.filter((d) => d.deckId === deck.id && Date.parse(d.due) <= nowMs).length,
      };
    })
    .sort((a, b) => b.reviews - a.reviews || a.title.localeCompare(b.title));
}

/** Bar height as a share (0…1) of the tallest bar; at least a sliver for non-zero values. */
export function barFraction(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(0.04, Math.min(1, value / max));
}

// ---------------------------------------------------------------------------------------------
// Everything together

/** Everything the Stats screen draws from, as stored. */
export type StatsData = {
  now: string;
  today: DayString;
  timeZone: string;
  goal: number;
  xpByDay: Record<DayString, number>;
  reviews: ReviewSample[];
  due: DueSample[];
  quiz: QuizSample[];
  decks: DeckSample[];
};

export type StatsView = {
  heatmap: HeatCell[][];
  activeDays: number;
  xpDays: DayValue[];
  xpTotal14: number;
  reviews: ReviewTotals;
  reviewDays: DayValue[];
  forecast: Forecast;
  quizByType: TypeAccuracy[];
  quizAnswered: number;
  /** Reviewing plus quizzes. */
  timeMs: number;
  timeMsToday: number;
  timeMsLast7: number;
  decks: DeckStats[];
  /** True when there is nothing to show yet. */
  empty: boolean;
};

export const HEATMAP_WEEKS = 12;
export const XP_CHART_DAYS = 14;
export const FORECAST_DAYS = 30;

/** Works out every chart and total from the stored history. */
export function buildStats(data: StatsData): StatsView {
  const heatmap = heatmapWeeks(data.xpByDay, data.today, data.goal, HEATMAP_WEEKS);
  const xpDays = dailySeries(data.xpByDay, data.today, XP_CHART_DAYS);
  const reviews = reviewTotals(data.reviews, data.today, data.timeZone);
  const quizMs = quizTimeMs(data.quiz);
  return {
    heatmap,
    activeDays: activeDays(heatmap),
    xpDays,
    xpTotal14: xpDays.reduce((sum, d) => sum + d.value, 0),
    reviews,
    reviewDays: dailySeries(reviewsByDay(data.reviews, data.timeZone), data.today, 7),
    forecast: reviewForecast(
      data.due.map((d) => d.due),
      data.today,
      data.timeZone,
      FORECAST_DAYS,
    ),
    quizByType: accuracyByType(data.quiz),
    quizAnswered: data.quiz.length,
    timeMs: reviews.timeMs + quizMs,
    timeMsToday: reviews.timeMsToday,
    timeMsLast7: reviews.timeMsLast7,
    decks: deckStats(data.decks, data.reviews, data.due, data.now),
    empty:
      data.reviews.length === 0 && data.quiz.length === 0 && Object.keys(data.xpByDay).length === 0,
  };
}
