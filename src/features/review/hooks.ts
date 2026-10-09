import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { setCardSuspended } from '@/features/decks/repo';
import { useProfile } from '@/features/profile/hooks';
import {
  previewIntervals,
  type IntervalPreview,
  type QueueEntry,
  type QueueKind,
  type RatingName,
  type ReviewRating,
} from '@/features/srs/logic';
import {
  answerCard,
  buryCard,
  loadReviewQueue,
  undoAnswer,
  unburyCard,
  type ReviewScope,
} from '@/features/srs/repo';
import { createLogger } from '@/lib/logger';
import { addDays, DEFAULT_TIMEZONE, nowIso, studyDay } from '@/lib/time';

import { cramAfterAnswer, pinToFront, shuffle, type ReviewMode, type SessionAnswer } from './logic';
import { loadCramCards, loadReviewItem, type ReviewItem } from './repo';

const log = createLogger('review');

function scopeKey(scope: ReviewScope): string {
  return scope === 'all' ? 'all' : scope.deckId;
}

/**
 * How many cards are due now in a deck (or every deck), within the daily limits. Re-counted each
 * time the screen comes into view and whenever `refreshKey` changes. null while counting.
 */
export function useDueCount(scope: ReviewScope, refreshKey?: unknown): number | null {
  const db = useDatabase();
  const { profile } = useProfile();
  const [count, setCount] = useState<number | null>(null);
  const ownerId = profile?.id;
  const timeZone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const key = scopeKey(scope);

  useFocusEffect(
    useCallback(() => {
      if (!ownerId) return undefined;
      let active = true;
      const queueScope: ReviewScope = key === 'all' ? 'all' : { deckId: key };
      loadReviewQueue(db, { ownerId, scope: queueScope, timeZone })
        .then(({ counts }) => {
          if (active) setCount(counts.new + counts.learning + counts.review);
        })
        .catch((error) => log.warn('Counting due cards failed', { error: String(error) }));
      return () => {
        active = false;
      };
      // refreshKey isn't read: changing it is what asks for a recount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, ownerId, timeZone, key, refreshKey]),
  );
  return count;
}

type Answered = SessionAnswer & {
  entry: QueueEntry;
  /** The review log to soft-delete on undo (null in cram mode). */
  logId: string | null;
  /** Cram mode: the queue before this answer, to put back on undo. */
  cramBefore: QueueEntry[] | null;
};

type View = {
  loaded: boolean;
  entries: QueueEntry[];
  counts: Record<QueueKind, number> | null;
  nextLearningDue: string | null;
  item: ReviewItem | null;
  revealed: boolean;
  intervals: Record<RatingName, IntervalPreview> | null;
  /** When the queue was last loaded (ms), for "come back in 8m". */
  loadedAt: number;
};

const emptyView: View = {
  loaded: false,
  entries: [],
  counts: null,
  nextLearningDue: null,
  item: null,
  revealed: false,
  intervals: null,
  loadedAt: 0,
};

export type ReviewStatus = 'loading' | 'studying' | 'finished' | 'empty';

/** An undo for a card action (suspend, bury), to offer in a toast. */
export type UndoAction = () => Promise<void>;

/**
 * A review session (PRODUCT_SPEC §5.1). In review mode every answer is saved through FSRS and the
 * queue is reloaded, so learning cards come back when due. In cram mode the deck's cards are
 * shuffled and answers change nothing in the database. Actions reject on failure.
 */
export function useReviewSession(scope: ReviewScope, mode: ReviewMode) {
  const db = useDatabase();
  const { profile } = useProfile();
  const ownerId = profile?.id;
  const timeZone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const key = scopeKey(scope);

  const [view, setViewState] = useState<View>(emptyView);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [busy, setBusy] = useState(false);
  // The latest view, for actions that run after awaits. Always set together with the state.
  const viewRef = useRef(emptyView);
  const setView = useCallback((next: View) => {
    viewRef.current = next;
    setViewState(next);
  }, []);
  const cram = useRef<QueueEntry[] | null>(null);
  const request = useRef(0);
  /** When the card on top was first shown (ms), to time the answer. */
  const shownAt = useRef(0);

  /**
   * Reloads the queue and the card on top. `pin` keeps a card on top if it is still in the queue
   * (after undo, or coming back from editing it); `keepRevealed` keeps its answer showing.
   */
  const refresh = useCallback(
    async ({ pin, keepRevealed = false }: { pin?: QueueEntry; keepRevealed?: boolean } = {}) => {
      if (!ownerId) return;
      const ticket = ++request.current;
      const queueScope: ReviewScope = key === 'all' ? 'all' : { deckId: key };
      let entries: QueueEntry[];
      let counts: View['counts'] = null;
      let nextLearningDue: string | null = null;
      if (mode === 'cram') {
        if (!cram.current)
          cram.current = shuffle(await loadCramCards(db, { ownerId, scope: queueScope }));
        entries = cram.current;
      } else {
        const queue = await loadReviewQueue(db, { ownerId, scope: queueScope, timeZone });
        entries = queue.entries;
        counts = queue.counts;
        nextLearningDue = queue.nextLearningDue;
      }
      const pinned = pin && entries.find((e) => e.instanceId === pin.instanceId);
      if (pinned) entries = pinToFront(entries, pinned, (e) => e.instanceId === pin.instanceId);

      // Skip anything deleted since the queue was built.
      let item: ReviewItem | null = null;
      while (entries.length > 0) {
        item = await loadReviewItem(db, entries[0].instanceId);
        if (item) break;
        entries = entries.slice(1);
      }
      if (mode === 'cram') cram.current = entries;
      if (ticket !== request.current) return;

      const previous = viewRef.current;
      const same = !!item && previous.item?.instanceId === item.instanceId;
      const revealed = keepRevealed && same && previous.revealed;
      const loadedAt = Date.now();
      if (!same) shownAt.current = loadedAt;
      setView({
        loadedAt,
        loaded: true,
        entries,
        counts,
        nextLearningDue,
        item,
        revealed,
        intervals: revealed ? intervalsFor(item, mode) : null,
      });
    },
    [db, ownerId, timeZone, key, mode, setView],
  );

  // Load on arrival, and again when coming back (e.g. from editing the card).
  useFocusEffect(
    useCallback(() => {
      const current = viewRef.current;
      refresh({ pin: current.entries[0], keepRevealed: true }).catch((error) =>
        log.warn('Loading the review queue failed', { error: String(error) }),
      );
    }, [refresh]),
  );

  const reveal = useCallback(() => {
    const v = viewRef.current;
    if (v.item && !v.revealed)
      setView({ ...v, revealed: true, intervals: intervalsFor(v.item, mode) });
  }, [mode, setView]);

  // One answer or undo at a time, even if a button is tapped twice quickly.
  const busyRef = useRef(false);
  const runBusy = useCallback(async (work: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const answer = useCallback(
    (rating: ReviewRating) =>
      runBusy(async () => {
        const { item, entries } = viewRef.current;
        const entry = entries[0];
        if (!item || !entry) return;
        const durationMs = Date.now() - shownAt.current;
        let logId: string | null = null;
        let cramBefore: QueueEntry[] | null = null;
        if (mode === 'cram') {
          cramBefore = cram.current ?? [];
          cram.current = cramAfterAnswer(cramBefore, rating);
        } else {
          logId = (await answerCard(db, { instanceId: item.instanceId, rating, durationMs })).logId;
        }
        setAnswered((list) => [
          ...list,
          { entry, instanceId: item.instanceId, rating, durationMs, logId, cramBefore },
        ]);
        await refresh();
      }),
    [db, mode, refresh, runBusy],
  );

  const undo = useCallback(
    () =>
      runBusy(async () => {
        const last = answered[answered.length - 1];
        if (!last) return;
        if (last.logId) await undoAnswer(db, last.logId);
        if (last.cramBefore) cram.current = last.cramBefore;
        setAnswered((list) => list.slice(0, -1));
        await refresh({ pin: last.entry });
      }),
    [answered, db, refresh, runBusy],
  );

  /** Suspends the card on screen (all its instances). Resolves to an undo. */
  const suspend = useCallback(async (): Promise<UndoAction | null> => {
    const { item, entries } = viewRef.current;
    if (!item) return null;
    const entry = entries[0];
    const cardId = item.card.id;
    const before = cram.current;
    await setCardSuspended(db, cardId, true);
    if (cram.current) cram.current = cram.current.filter((e) => e.cardId !== cardId);
    await refresh();
    return async () => {
      await setCardSuspended(db, cardId, false);
      if (before) cram.current = before;
      await refresh({ pin: entry });
    };
  }, [db, refresh]);

  /** Buries the card on screen until tomorrow's study day. Resolves to an undo. */
  const bury = useCallback(async (): Promise<UndoAction | null> => {
    const { item, entries } = viewRef.current;
    if (!item) return null;
    const entry = entries[0];
    const before = cram.current;
    const tomorrow = addDays(studyDay(nowIso(), timeZone), 1);
    await buryCard(db, item.instanceId, tomorrow);
    if (cram.current) cram.current = cram.current.filter((e) => e.instanceId !== item.instanceId);
    await refresh();
    return async () => {
      await unburyCard(db, item.instanceId);
      if (before) cram.current = before;
      await refresh({ pin: entry });
    };
  }, [db, refresh, timeZone]);

  const status: ReviewStatus = !view.loaded
    ? 'loading'
    : view.item
      ? 'studying'
      : answered.length > 0
        ? 'finished'
        : 'empty';

  return {
    status,
    mode,
    item: view.item,
    revealed: view.revealed,
    intervals: view.intervals,
    counts: view.counts,
    remaining: view.entries.length,
    nextLearningDue: view.nextLearningDue,
    loadedAt: view.loadedAt,
    answers: answered as readonly SessionAnswer[],
    canUndo: answered.length > 0,
    busy,
    reveal,
    answer,
    undo,
    suspend,
    bury,
    /** Looks for cards again (learning cards that have come due). */
    reload: () => refresh(),
  };
}

export type ReviewSession = ReturnType<typeof useReviewSession>;

function intervalsFor(
  item: ReviewItem | null,
  mode: ReviewMode,
): Record<RatingName, IntervalPreview> | null {
  if (!item || mode === 'cram') return null;
  return previewIntervals(item.state, nowIso(), { desiredRetention: item.desiredRetention });
}
