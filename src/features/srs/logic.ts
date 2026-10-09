import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type FSRS,
  type Grade,
} from 'ts-fsrs';

import type { SrsState } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { studyDay, studyDayEnd, toIso, type DayString, type Instant } from '@/lib/time';

// Pure scheduling rules for flashcard reviews (PRODUCT_SPEC §5.1, ARCHITECTURE §3.3): a thin
// wrapper around ts-fsrs, interval labels for the rating buttons, replaying a review history,
// and building the day's review queue. No React and no database, so all of it is unit-tested.

// ---------------------------------------------------------------------------------------------
// Ratings and states

/** The four answer buttons, as FSRS numbers them. */
export const RATINGS = { again: 1, hard: 2, good: 3, easy: 4 } as const;
export type RatingName = keyof typeof RATINGS;
export type ReviewRating = (typeof RATINGS)[RatingName];
export const RATING_NAMES = Object.keys(RATINGS) as RatingName[];

export function isReviewRating(value: unknown): value is ReviewRating {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

const STATE_NAMES: Record<State, SrsState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};
const STATE_VALUES: Record<SrsState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

// ---------------------------------------------------------------------------------------------
// Card state ↔ ts-fsrs

/** A card instance's FSRS state as the `card_state` table stores it (times as ISO strings). */
export type CardStateValues = {
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: SrsState;
  lastReview: string | null;
};

/** What a `review_logs` row records: the card's state *before* the answer, and the answer. */
export type ReviewLogValues = {
  rating: ReviewRating;
  state: SrsState;
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reviewedAt: string;
};

/** The state of a card that has never been reviewed. */
export function newCardState(now: Instant): CardStateValues {
  return fromFsrsCard(createEmptyCard(new Date(toIso(now))));
}

function toFsrsCard(values: CardStateValues): FsrsCard {
  return {
    due: new Date(values.due),
    stability: values.stability,
    difficulty: values.difficulty,
    elapsed_days: values.elapsedDays,
    scheduled_days: values.scheduledDays,
    learning_steps: values.learningSteps,
    reps: values.reps,
    lapses: values.lapses,
    state: STATE_VALUES[values.state],
    last_review: values.lastReview ? new Date(values.lastReview) : undefined,
  };
}

function fromFsrsCard(card: FsrsCard): CardStateValues {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_NAMES[card.state],
    lastReview: card.last_review ? card.last_review.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Scheduling

/** Per-deck scheduling settings (PRODUCT_SPEC §4.2). */
export type SchedulerOptions = { desiredRetention: number };

/** Retention outside this range is clamped (deck settings allow 0.70–0.99). */
const RETENTION_RANGE = { min: 0.7, max: 0.99 };

const schedulers = new Map<number, FSRS>();

/**
 * The ts-fsrs scheduler for a desired retention. Default FSRS weights and (re)learning steps
 * (1m, 10m / 10m); fuzz is on so cards added together spread out. ts-fsrs seeds the fuzz from
 * the review time and the card's state, so replaying the same history gives the same dates.
 */
function schedulerFor({ desiredRetention }: SchedulerOptions): FSRS {
  const retention = Number.isFinite(desiredRetention)
    ? Math.min(RETENTION_RANGE.max, Math.max(RETENTION_RANGE.min, desiredRetention))
    : 0.9;
  let scheduler = schedulers.get(retention);
  if (!scheduler) {
    scheduler = fsrs(generatorParameters({ request_retention: retention, enable_fuzz: true }));
    schedulers.set(retention, scheduler);
  }
  return scheduler;
}

export type ReviewOutcome = { next: CardStateValues; log: ReviewLogValues };

/**
 * Answers a card: the new state and the log row to store. `current` is null for a card that has
 * never been reviewed (no `card_state` row yet).
 */
export function reviewCard(
  current: CardStateValues | null,
  rating: ReviewRating,
  now: Instant,
  options: SchedulerOptions,
): ReviewOutcome {
  if (!isReviewRating(rating)) throw new RangeError(`Not a rating: ${String(rating)}`);
  const at = new Date(toIso(now));
  const card = current ? toFsrsCard(current) : createEmptyCard(at);
  const { card: next, log } = schedulerFor(options).next(card, at, rating as Grade);
  return {
    next: fromFsrsCard(next),
    log: {
      rating,
      state: STATE_NAMES[log.state],
      due: log.due.toISOString(),
      stability: log.stability,
      difficulty: log.difficulty,
      elapsedDays: log.elapsed_days,
      scheduledDays: log.scheduled_days,
      learningSteps: log.learning_steps,
      reviewedAt: log.review.toISOString(),
    },
  };
}

export type IntervalPreview = { due: string; label: string };

/** What each rating button would do now: the next due time and a short label ("10m", "3d"). */
export function previewIntervals(
  current: CardStateValues | null,
  now: Instant,
  options: SchedulerOptions,
): Record<RatingName, IntervalPreview> {
  const at = new Date(toIso(now));
  const card = current ? toFsrsCard(current) : createEmptyCard(at);
  const preview = schedulerFor(options).repeat(card, at);
  const entry = (rating: Grade): IntervalPreview => {
    const due = preview[rating].card.due;
    return { due: due.toISOString(), label: formatInterval(due.getTime() - at.getTime()) };
  };
  return {
    again: entry(Rating.Again),
    hard: entry(Rating.Hard),
    good: entry(Rating.Good),
    easy: entry(Rating.Easy),
  };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A short, rounded label for a time span: 1m … 59m, 1h … 23h, 1d … 29d, 1mo … 11mo, then years
 * with one decimal ("1.5y"). Never shows less than 1m.
 */
export function formatInterval(ms: number): string {
  const label = strings.srs.interval;
  const span = Math.max(0, ms);
  if (span < HOUR - MINUTE / 2) return label.minutes(Math.max(1, Math.round(span / MINUTE)));
  if (span < DAY - HOUR / 2) return label.hours(Math.max(1, Math.round(span / HOUR)));
  const days = Math.round(span / DAY);
  if (days < 30) return label.days(Math.max(1, days));
  if (days < 365) return label.months(Math.min(11, Math.max(1, Math.round(days / 30))));
  const years = Math.round((days / 365) * 10) / 10;
  return label.years(Number.isInteger(years) ? String(years) : years.toFixed(1));
}

// ---------------------------------------------------------------------------------------------
// Replay

export type LoggedAnswer = { rating: number; reviewedAt: string };

/**
 * Rebuilds a card's state from its review history, oldest first (ties keep the given order).
 * Used after sync brings answers made on another phone, and by undo. Answers with an unknown
 * rating are skipped. Returns null when there is nothing to replay (the card is new).
 */
export function replayReviews(
  answers: readonly LoggedAnswer[],
  options: SchedulerOptions,
): CardStateValues | null {
  const ordered = answers
    .map((answer, index) => ({ answer, index, time: Date.parse(answer.reviewedAt) }))
    .filter(({ answer, time }) => isReviewRating(answer.rating) && Number.isFinite(time))
    .sort((a, b) => a.time - b.time || a.index - b.index);
  let state: CardStateValues | null = null;
  for (const { answer } of ordered) {
    state = reviewCard(state, answer.rating as ReviewRating, answer.reviewedAt, options).next;
  }
  return state;
}

// ---------------------------------------------------------------------------------------------
// The review queue

/** One card instance that could be studied, with its FSRS state (null = never reviewed). */
export type QueueCandidate = {
  instanceId: string;
  cardId: string;
  deckId: string;
  subKey: string;
  cardCreatedAt: string;
  state: CardStateValues | null;
  /** "Bury until tomorrow": hidden until this study day begins. */
  buriedUntil: string | null;
};

/** A deck's daily limits and what has already been studied today. */
export type DeckAllowance = {
  newPerDay: number;
  maxReviewsPerDay: number;
  newDoneToday: number;
  reviewsDoneToday: number;
};

export type QueueKind = 'learning' | 'review' | 'new';

export type QueueEntry = { instanceId: string; cardId: string; deckId: string; kind: QueueKind };

export type ReviewQueue = {
  entries: QueueEntry[];
  counts: Record<QueueKind, number>;
  /** When the next learning card not in the queue becomes due (to say "come back in 8m"). */
  nextLearningDue: string | null;
};

export type QueueOptions = {
  now: Instant;
  timeZone: string;
  /** Learning cards due this soon are added at the end, so a session can finish (Anki: 20). */
  learnAheadMinutes?: number;
};

const naturalOrder = new Intl.Collator('en', { numeric: true }).compare;

/**
 * The cards to study now, in order (PRODUCT_SPEC §5.1):
 * 1. learning and relearning cards that are due, earliest first;
 * 2. due reviews (most overdue first) with new cards spread evenly among them, each within its
 *    deck's reviews/day and new/day allowance;
 * 3. learning cards due within the learn-ahead window, so the session can end.
 *
 * A review card counts as due for the whole study day its due time falls in (it rolls over at
 * 03:00), so a card due at 20:00 can be reviewed in the morning. Learning cards use the exact
 * time. Buried cards are left out until their day; limits never cut learning cards.
 */
export function buildReviewQueue(
  candidates: readonly QueueCandidate[],
  allowances: ReadonlyMap<string, DeckAllowance>,
  { now, timeZone, learnAheadMinutes = 20 }: QueueOptions,
): ReviewQueue {
  const nowIso = toIso(now);
  const today: DayString = studyDay(nowIso, timeZone);
  const endOfDay = studyDayEnd(today, timeZone);
  const learnAheadUntil = new Date(Date.parse(nowIso) + learnAheadMinutes * MINUTE).toISOString();

  const learningNow: QueueCandidate[] = [];
  const learningSoon: QueueCandidate[] = [];
  const reviews: QueueCandidate[] = [];
  const fresh: QueueCandidate[] = [];
  let nextLearningDue: string | null = null;

  for (const candidate of candidates) {
    if (candidate.buriedUntil && today < candidate.buriedUntil) continue;
    const { state } = candidate;
    if (!state || state.state === 'new') {
      fresh.push(candidate);
    } else if (state.state === 'review') {
      if (state.due < endOfDay) reviews.push(candidate);
    } else if (state.due <= nowIso) {
      learningNow.push(candidate);
    } else if (state.due <= learnAheadUntil) {
      learningSoon.push(candidate);
    } else if (!nextLearningDue || state.due < nextLearningDue) {
      nextLearningDue = state.due;
    }
  }

  const byDue = (a: QueueCandidate, b: QueueCandidate) =>
    a.state!.due.localeCompare(b.state!.due) || a.instanceId.localeCompare(b.instanceId);
  const byAdded = (a: QueueCandidate, b: QueueCandidate) =>
    a.cardCreatedAt.localeCompare(b.cardCreatedAt) ||
    a.cardId.localeCompare(b.cardId) ||
    naturalOrder(a.subKey, b.subKey) ||
    a.instanceId.localeCompare(b.instanceId);

  const left = new Map<string, { reviews: number; fresh: number }>();
  const remaining = (deckId: string) => {
    let entry = left.get(deckId);
    if (!entry) {
      const allowance = allowances.get(deckId);
      entry = {
        reviews: allowance
          ? Math.max(0, allowance.maxReviewsPerDay - allowance.reviewsDoneToday)
          : 0,
        fresh: allowance ? Math.max(0, allowance.newPerDay - allowance.newDoneToday) : 0,
      };
      left.set(deckId, entry);
    }
    return entry;
  };
  const takeReviews = reviews.sort(byDue).filter((c) => remaining(c.deckId).reviews-- > 0);
  const takeFresh = fresh.sort(byAdded).filter((c) => remaining(c.deckId).fresh-- > 0);

  const entry = (kind: QueueKind) => (c: QueueCandidate) => ({
    instanceId: c.instanceId,
    cardId: c.cardId,
    deckId: c.deckId,
    kind,
  });
  const entries = [
    ...learningNow.sort(byDue).map(entry('learning')),
    ...interleave(takeReviews.map(entry('review')), takeFresh.map(entry('new'))),
    ...learningSoon.sort(byDue).map(entry('learning')),
  ];
  return {
    entries,
    counts: {
      learning: learningNow.length + learningSoon.length,
      review: takeReviews.length,
      new: takeFresh.length,
    },
    nextLearningDue,
  };
}

/**
 * Spreads `extra` evenly through `main`, keeping both orders: with 4 reviews and 1 new card the
 * new one comes after the 2nd review; with no reviews the new cards are all there is.
 */
export function interleave<T>(main: readonly T[], extra: readonly T[]): T[] {
  const result: T[] = [];
  let used = 0;
  extra.forEach((item, k) => {
    const before = Math.floor(((k + 1) * main.length) / (extra.length + 1));
    while (used < before) result.push(main[used++]);
    result.push(item);
  });
  while (used < main.length) result.push(main[used++]);
  return result;
}
