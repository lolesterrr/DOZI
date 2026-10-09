import { and, asc, eq, gte, isNull, lt, or, sql } from 'drizzle-orm';

import { cardInstances, cards, cardState, decks, reviewLogs, type CardStateRow } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId as defaultNewId } from '@/lib/ids';
import { nowIso, studyDay, studyDayEnd, studyDayStart } from '@/lib/time';

import {
  buildReviewQueue,
  newCardState,
  replayReviews,
  reviewCard,
  type CardStateValues,
  type DeckAllowance,
  type QueueCandidate,
  type ReviewQueue,
  type ReviewRating,
} from './logic';

// FSRS state and review history (ARCHITECTURE §3.3). Answers append to `review_logs`; the
// `card_state` row is always what replaying those logs gives. Every change marks rows dirty.

type Deps = { newId?: () => string; now?: () => string };
type NowDep = Pick<Deps, 'now'>;

const isoNow = () => nowIso();

/** Which cards a session draws from: one deck, or every deck. */
export type ReviewScope = 'all' | { deckId: string };

function stateValues(row: CardStateRow): CardStateValues {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsedDays: row.elapsedDays,
    scheduledDays: row.scheduledDays,
    learningSteps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    lastReview: row.lastReview,
  };
}

/** A card instance's current FSRS state, or null if it has never been reviewed. */
export async function getCardState(
  db: AppDatabase,
  instanceId: string,
): Promise<CardStateValues | null> {
  const rows = await db
    .select()
    .from(cardState)
    .where(and(eq(cardState.cardInstanceId, instanceId), isNull(cardState.deletedAt)))
    .limit(1);
  return rows[0] ? stateValues(rows[0]) : null;
}

// ---------------------------------------------------------------------------------------------
// The queue

export type QueueRequest = { ownerId: string; scope: ReviewScope; timeZone: string };

/**
 * The cards to study now in a deck (or every deck), in order, within each deck's daily limits.
 * Suspended and deleted cards, and cards of deleted decks, are left out.
 */
export async function loadReviewQueue(
  db: AppDatabase,
  { ownerId, scope, timeZone }: QueueRequest,
  { now = isoNow }: NowDep = {},
): Promise<ReviewQueue> {
  const at = now();
  const today = studyDay(at, timeZone);
  const deckFilter = scope === 'all' ? undefined : eq(decks.id, scope.deckId);

  const rows = await db
    .select({
      instanceId: cardInstances.id,
      cardId: cards.id,
      deckId: cards.deckId,
      subKey: cardInstances.subKey,
      cardCreatedAt: cards.createdAt,
      state: cardState,
    })
    .from(cardInstances)
    .innerJoin(cards, eq(cards.id, cardInstances.cardId))
    .innerJoin(decks, eq(decks.id, cards.deckId))
    .leftJoin(
      cardState,
      and(eq(cardState.cardInstanceId, cardInstances.id), isNull(cardState.deletedAt)),
    )
    .where(
      and(
        eq(cardInstances.ownerId, ownerId),
        isNull(cardInstances.deletedAt),
        isNull(cards.deletedAt),
        eq(cards.suspended, false),
        isNull(decks.deletedAt),
        deckFilter,
        // Reviews due after today can't be in the queue; skip loading them.
        or(
          isNull(cardState.cardInstanceId),
          sql`${cardState.state} <> 'review'`,
          lt(cardState.due, studyDayEnd(today, timeZone)),
        ),
      ),
    );

  const candidates: QueueCandidate[] = rows.map((row) => ({
    instanceId: row.instanceId,
    cardId: row.cardId,
    deckId: row.deckId,
    subKey: row.subKey,
    cardCreatedAt: row.cardCreatedAt,
    state: row.state ? stateValues(row.state) : null,
    buriedUntil: row.state?.buriedUntil ?? null,
  }));
  const allowances = await deckAllowances(db, ownerId, scope, today, timeZone);
  return buildReviewQueue(candidates, allowances, { now: at, timeZone });
}

/** Each deck's limits, and how many new cards and reviews it has had this study day. */
export async function deckAllowances(
  db: AppDatabase,
  ownerId: string,
  scope: ReviewScope,
  today: string,
  timeZone: string,
): Promise<Map<string, DeckAllowance>> {
  const deckRows = await db
    .select({
      id: decks.id,
      newPerDay: decks.newPerDay,
      maxReviewsPerDay: decks.maxReviewsPerDay,
    })
    .from(decks)
    .where(
      and(
        eq(decks.ownerId, ownerId),
        isNull(decks.deletedAt),
        scope === 'all' ? undefined : eq(decks.id, scope.deckId),
      ),
    );
  const done = await db
    .select({
      deckId: cards.deckId,
      newDone: sql<number>`sum(case when ${reviewLogs.state} = 'new' then 1 else 0 end)`,
      reviewsDone: sql<number>`sum(case when ${reviewLogs.state} = 'review' then 1 else 0 end)`,
    })
    .from(reviewLogs)
    .innerJoin(cardInstances, eq(cardInstances.id, reviewLogs.cardInstanceId))
    .innerJoin(cards, eq(cards.id, cardInstances.cardId))
    .where(
      and(
        eq(reviewLogs.ownerId, ownerId),
        isNull(reviewLogs.deletedAt),
        gte(reviewLogs.reviewedAt, studyDayStart(today, timeZone)),
        lt(reviewLogs.reviewedAt, studyDayEnd(today, timeZone)),
      ),
    )
    .groupBy(cards.deckId);
  const doneByDeck = new Map(done.map((d) => [d.deckId, d]));
  return new Map(
    deckRows.map((deck) => {
      const today = doneByDeck.get(deck.id);
      return [
        deck.id,
        {
          newPerDay: deck.newPerDay,
          maxReviewsPerDay: deck.maxReviewsPerDay,
          newDoneToday: Number(today?.newDone ?? 0),
          reviewsDoneToday: Number(today?.reviewsDone ?? 0),
        },
      ];
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Answering, undo and replay

type InstanceInfo = { ownerId: string; desiredRetention: number };

function instanceInfo(db: AppDatabase, instanceId: string): InstanceInfo {
  const [row] = db
    .select({ ownerId: cardInstances.ownerId, desiredRetention: decks.desiredRetention })
    .from(cardInstances)
    .innerJoin(cards, eq(cards.id, cardInstances.cardId))
    .innerJoin(decks, eq(decks.id, cards.deckId))
    .where(eq(cardInstances.id, instanceId))
    .limit(1)
    .all();
  if (!row) throw new Error('That card is no longer here');
  return row;
}

/** Writes a card's new state, reviving the row if it had been cleared. Keeps `buried_until`. */
function saveState(
  db: AppDatabase,
  instanceId: string,
  ownerId: string,
  values: CardStateValues,
  timestamp: string,
) {
  const set = { ...values, deletedAt: null, updatedAt: timestamp, dirty: true };
  db.insert(cardState)
    .values({ cardInstanceId: instanceId, ownerId, createdAt: timestamp, ...set })
    .onConflictDoUpdate({ target: cardState.cardInstanceId, set })
    .run();
}

export type AnswerInput = {
  instanceId: string;
  rating: ReviewRating;
  /** How long the card was on screen before the answer. */
  durationMs?: number | null;
};

export type AnswerResult = { logId: string; state: CardStateValues };

/** Records an answer: appends a review log and moves the card's FSRS state on. */
export async function answerCard(
  db: AppDatabase,
  { instanceId, rating, durationMs = null }: AnswerInput,
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<AnswerResult> {
  const timestamp = now();
  return db.transaction((tx) => {
    const info = instanceInfo(tx, instanceId);
    const [current] = tx
      .select()
      .from(cardState)
      .where(and(eq(cardState.cardInstanceId, instanceId), isNull(cardState.deletedAt)))
      .limit(1)
      .all();
    const { next, log } = reviewCard(current ? stateValues(current) : null, rating, timestamp, {
      desiredRetention: info.desiredRetention,
    });
    const logId = newId();
    tx.insert(reviewLogs)
      .values({
        id: logId,
        ownerId: info.ownerId,
        cardInstanceId: instanceId,
        ...log,
        reviewDurationMs: durationMs == null ? null : Math.max(0, Math.round(durationMs)),
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
    saveState(tx, instanceId, info.ownerId, next, timestamp);
    return { logId, state: next };
  });
}

/**
 * Undoes an answer: the log is soft-deleted and the card's state is rebuilt from the answers
 * left. Returns the restored state (null = the card is new again).
 */
export async function undoAnswer(
  db: AppDatabase,
  logId: string,
  { now = isoNow }: NowDep = {},
): Promise<CardStateValues | null> {
  const timestamp = now();
  return db.transaction((tx) => {
    const [log] = tx
      .select({ cardInstanceId: reviewLogs.cardInstanceId })
      .from(reviewLogs)
      .where(eq(reviewLogs.id, logId))
      .limit(1)
      .all();
    if (!log) throw new Error('That answer is no longer here');
    tx.update(reviewLogs)
      .set({ deletedAt: timestamp, updatedAt: timestamp, dirty: true })
      .where(and(eq(reviewLogs.id, logId), isNull(reviewLogs.deletedAt)))
      .run();
    return rebuild(tx, log.cardInstanceId, timestamp);
  });
}

/**
 * Rebuilds a card's state by replaying its review logs through FSRS (ARCHITECTURE §4: after a
 * sync brings answers from another phone). Returns the new state (null = never reviewed).
 */
export async function rebuildCardState(
  db: AppDatabase,
  instanceId: string,
  { now = isoNow }: NowDep = {},
): Promise<CardStateValues | null> {
  const timestamp = now();
  return db.transaction((tx) => rebuild(tx, instanceId, timestamp));
}

function rebuild(db: AppDatabase, instanceId: string, timestamp: string): CardStateValues | null {
  const info = instanceInfo(db, instanceId);
  const answers = db
    .select({ rating: reviewLogs.rating, reviewedAt: reviewLogs.reviewedAt })
    .from(reviewLogs)
    .where(and(eq(reviewLogs.cardInstanceId, instanceId), isNull(reviewLogs.deletedAt)))
    .orderBy(asc(reviewLogs.reviewedAt), asc(reviewLogs.createdAt), asc(reviewLogs.id))
    .all();
  const state = replayReviews(answers, { desiredRetention: info.desiredRetention });
  if (state) {
    saveState(db, instanceId, info.ownerId, state, timestamp);
  } else {
    db.update(cardState)
      .set({ deletedAt: timestamp, updatedAt: timestamp, dirty: true })
      .where(and(eq(cardState.cardInstanceId, instanceId), isNull(cardState.deletedAt)))
      .run();
  }
  return state;
}

// ---------------------------------------------------------------------------------------------
// Bury until tomorrow

/**
 * Hides a card instance from reviews until the study day `untilDay` (`YYYY-MM-DD`) begins. Its
 * schedule doesn't change. A card never reviewed gets a "new" state row to hold the date.
 */
export async function buryCard(
  db: AppDatabase,
  instanceId: string,
  untilDay: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const timestamp = now();
  db.transaction((tx) => {
    const set = { buriedUntil: untilDay, updatedAt: timestamp, dirty: true };
    const [live] = tx
      .select({ id: cardState.cardInstanceId })
      .from(cardState)
      .where(and(eq(cardState.cardInstanceId, instanceId), isNull(cardState.deletedAt)))
      .limit(1)
      .all();
    if (live) {
      tx.update(cardState).set(set).where(eq(cardState.cardInstanceId, instanceId)).run();
      return;
    }
    const info = instanceInfo(tx, instanceId);
    const fresh = { ...newCardState(timestamp), ...set, deletedAt: null };
    tx.insert(cardState)
      .values({ cardInstanceId: instanceId, ownerId: info.ownerId, createdAt: timestamp, ...fresh })
      .onConflictDoUpdate({ target: cardState.cardInstanceId, set: fresh })
      .run();
  });
}

/** Undoes "bury": the card can come back today. */
export async function unburyCard(
  db: AppDatabase,
  instanceId: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const timestamp = now();
  await db
    .update(cardState)
    .set({ buriedUntil: null, updatedAt: timestamp, dirty: true })
    .where(eq(cardState.cardInstanceId, instanceId));
}
