import {
  buildReviewQueue,
  formatInterval,
  interleave,
  newCardState,
  previewIntervals,
  replayReviews,
  reviewCard,
  RATINGS,
  type CardStateValues,
  type DeckAllowance,
  type QueueCandidate,
  type ReviewRating,
} from '../logic';

const TZ = 'Africa/Kampala'; // UTC+3, no daylight saving
const options = { desiredRetention: 0.9 };
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** 10:00 in Kampala on 9 Oct 2026. */
const start = Date.parse('2026-10-09T07:00:00Z');
const at = (ms: number) => new Date(start + ms).toISOString();

/** Answers a card several times, `gap` ms after each due time (or right away for learning). */
function answer(ratings: ReviewRating[], from = start) {
  let state: CardStateValues | null = null;
  let time = from;
  const history: { rating: number; reviewedAt: string }[] = [];
  for (const rating of ratings) {
    const reviewedAt = new Date(time).toISOString();
    state = reviewCard(state, rating, reviewedAt, options).next;
    history.push({ rating, reviewedAt });
    time = Math.max(time + MINUTE, Date.parse(state.due));
  }
  return { state: state!, history, nextTime: time };
}

describe('reviewCard', () => {
  it('moves a new card into learning on Good, ten minutes away', () => {
    const { next, log } = reviewCard(null, RATINGS.good, at(0), options);
    expect(next).toMatchObject({ state: 'learning', reps: 1, lapses: 0, lastReview: at(0) });
    expect(next.due).toBe(at(10 * MINUTE));
    expect(log).toMatchObject({ rating: 3, state: 'new', reviewedAt: at(0) });
  });

  it('starts from the same state when given an empty card or nothing', () => {
    expect(reviewCard(newCardState(at(0)), 1, at(0), options).next).toEqual(
      reviewCard(null, 1, at(0), options).next,
    );
  });

  it('graduates to review, then lapses into relearning on Again', () => {
    const { state, nextTime } = answer([RATINGS.good, RATINGS.good]);
    expect(state.state).toBe('review');
    expect(state.scheduledDays).toBeGreaterThanOrEqual(1);

    const { next, log } = reviewCard(state, RATINGS.again, new Date(nextTime), options);
    expect(log.state).toBe('review');
    expect(next).toMatchObject({ state: 'relearning', lapses: 1 });
    expect(Date.parse(next.due) - nextTime).toBe(10 * MINUTE);
  });

  it('gives longer intervals for Easy than Good, and Good than Hard', () => {
    const { state, nextTime } = answer([RATINGS.good, RATINGS.good, RATINGS.good]);
    const p = previewIntervals(state, new Date(nextTime), options);
    expect(Date.parse(p.hard.due)).toBeLessThan(Date.parse(p.good.due));
    expect(Date.parse(p.good.due)).toBeLessThan(Date.parse(p.easy.due));
  });

  it('schedules sooner when the deck asks for higher retention', () => {
    const { state, nextTime } = answer([RATINGS.good, RATINGS.good, RATINGS.good]);
    const strict = reviewCard(state, 3, new Date(nextTime), { desiredRetention: 0.97 }).next;
    const relaxed = reviewCard(state, 3, new Date(nextTime), { desiredRetention: 0.75 }).next;
    expect(strict.scheduledDays).toBeLessThan(relaxed.scheduledDays);
  });

  it('keeps retention within 70–99 %', () => {
    const { state, nextTime } = answer([RATINGS.good, RATINGS.good, RATINGS.good]);
    const when = new Date(nextTime);
    expect(reviewCard(state, 3, when, { desiredRetention: 0.2 }).next).toEqual(
      reviewCard(state, 3, when, { desiredRetention: 0.7 }).next,
    );
    expect(reviewCard(state, 3, when, { desiredRetention: Number.NaN }).next).toEqual(
      reviewCard(state, 3, when, { desiredRetention: 0.9 }).next,
    );
  });

  it('refuses a rating that is not 1–4', () => {
    expect(() => reviewCard(null, 0 as ReviewRating, at(0), options)).toThrow(RangeError);
    expect(() => reviewCard(null, 5 as ReviewRating, at(0), options)).toThrow(RangeError);
  });
});

describe('previewIntervals', () => {
  it('labels the learning steps of a new card', () => {
    const p = previewIntervals(null, at(0), options);
    expect(p.again.label).toBe('1m');
    expect(p.hard.label).toBe('6m');
    expect(p.good.label).toBe('10m');
    expect(p.easy.label).toMatch(/^\d+d$/);
  });

  it('matches what answering actually does', () => {
    const { state, nextTime } = answer([RATINGS.good, RATINGS.good]);
    const when = new Date(nextTime);
    const p = previewIntervals(state, when, options);
    expect(p.good.due).toBe(reviewCard(state, 3, when, options).next.due);
    expect(p.again.due).toBe(reviewCard(state, 1, when, options).next.due);
  });
});

describe('formatInterval', () => {
  it.each([
    [0, '1m'],
    [20 * 1000, '1m'],
    [10 * MINUTE, '10m'],
    [59 * MINUTE, '59m'],
    [60 * MINUTE, '1h'],
    [5.4 * 60 * MINUTE, '5h'],
    [23 * 60 * MINUTE, '23h'],
    [DAY, '1d'],
    [3 * DAY, '3d'],
    [29 * DAY, '29d'],
    [45 * DAY, '2mo'],
    [364 * DAY, '11mo'],
    [365 * DAY, '1y'],
    [548 * DAY, '1.5y'],
  ])('%d ms → %s', (ms, label) => {
    expect(formatInterval(ms)).toBe(label);
  });
});

describe('replayReviews', () => {
  it('rebuilds exactly the state the answers produced', () => {
    const ratings: ReviewRating[] = [3, 3, 1, 3, 2, 4, 3];
    const { state, history } = answer(ratings);
    expect(replayReviews(history, options)).toEqual(state);
  });

  it('sorts answers by time, so logs from two phones merge correctly', () => {
    const { state, history } = answer([3, 3, 3, 1, 3]);
    const shuffled = [history[3], history[0], history[4], history[2], history[1]];
    expect(replayReviews(shuffled, options)).toEqual(state);
  });

  it('skips answers with an unknown rating or time', () => {
    const { state, history } = answer([3, 3]);
    const noisy = [
      history[0],
      { rating: 0, reviewedAt: at(1) },
      { rating: 3, reviewedAt: 'not a time' },
      history[1],
    ];
    expect(replayReviews(noisy, options)).toEqual(state);
  });

  it('returns null for a card with no answers', () => {
    expect(replayReviews([], options)).toBeNull();
  });
});

describe('interleave', () => {
  it('spreads the extra items evenly', () => {
    expect(interleave(['r1', 'r2', 'r3', 'r4'], ['n1'])).toEqual(['r1', 'r2', 'n1', 'r3', 'r4']);
    expect(interleave(['r1', 'r2', 'r3', 'r4', 'r5'], ['n1', 'n2'])).toEqual([
      'r1',
      'n1',
      'r2',
      'r3',
      'n2',
      'r4',
      'r5',
    ]);
    expect(interleave([], ['n1', 'n2'])).toEqual(['n1', 'n2']);
    expect(interleave(['r1', 'r2'], [])).toEqual(['r1', 'r2']);
  });
});

// ---------------------------------------------------------------------------------------------

describe('buildReviewQueue', () => {
  const now = at(0); // 10:00 local; the study day ends tomorrow at 03:00 (00:00Z)

  const state = (kind: CardStateValues['state'], due: string): CardStateValues => ({
    ...newCardState(now),
    state: kind,
    due,
    reps: 2,
  });

  let n = 0;
  const candidate = (
    over: Partial<QueueCandidate> & { state: CardStateValues | null },
  ): QueueCandidate => {
    n += 1;
    return {
      instanceId: `i${String(n).padStart(2, '0')}`,
      cardId: `card${String(n).padStart(2, '0')}`,
      deckId: 'd1',
      subKey: 'front',
      cardCreatedAt: at(-DAY + n * MINUTE),
      buriedUntil: null,
      ...over,
    };
  };

  const allow = (over: Partial<DeckAllowance> = {}): DeckAllowance => ({
    newPerDay: 15,
    maxReviewsPerDay: 200,
    newDoneToday: 0,
    reviewsDoneToday: 0,
    ...over,
  });
  const decks = (entries: Record<string, DeckAllowance>) => new Map(Object.entries(entries));
  const ids = (q: { entries: { instanceId: string }[] }) => q.entries.map((e) => e.instanceId);

  beforeEach(() => {
    n = 0;
  });

  it('puts due learning cards first, then reviews with new cards mixed in, then learn-ahead', () => {
    const soon = candidate({ state: state('learning', at(5 * MINUTE)) }); // i01
    const review1 = candidate({ state: state('review', at(-2 * DAY)) }); // i02
    const learning = candidate({ state: state('relearning', at(-MINUTE)) }); // i03
    const review2 = candidate({ state: state('review', at(-DAY)) }); // i04
    const fresh = candidate({ state: null }); // i05
    const review3 = candidate({ state: state('review', at(2 * 60 * MINUTE)) }); // i06
    const review4 = candidate({ state: state('review', at(3 * 60 * MINUTE)) }); // i07

    const q = buildReviewQueue(
      [soon, review1, learning, review2, fresh, review3, review4],
      decks({ d1: allow() }),
      { now, timeZone: TZ },
    );
    expect(ids(q)).toEqual(['i03', 'i02', 'i04', 'i05', 'i06', 'i07', 'i01']);
    expect(q.entries.map((e) => e.kind)).toEqual([
      'learning',
      'review',
      'review',
      'new',
      'review',
      'review',
      'learning',
    ]);
    expect(q.counts).toEqual({ learning: 2, review: 4, new: 1 });
  });

  it('counts a review as due for its whole study day, which rolls over at 03:00', () => {
    // Today's study day runs until 03:00 local tomorrow = 00:00Z on 10 Oct.
    const tonight = candidate({ state: state('review', '2026-10-09T23:59:00Z') }); // 02:59 local
    const tomorrow = candidate({ state: state('review', '2026-10-10T00:00:00Z') }); // 03:00 local
    const q = buildReviewQueue([tonight, tomorrow], decks({ d1: allow() }), {
      now,
      timeZone: TZ,
    });
    expect(ids(q)).toEqual([tonight.instanceId]);
  });

  it('leaves out learning cards due later and says when the next one is due', () => {
    const later = candidate({ state: state('learning', at(30 * MINUTE)) });
    const later2 = candidate({ state: state('learning', at(25 * MINUTE)) });
    const q = buildReviewQueue([later, later2], decks({ d1: allow() }), { now, timeZone: TZ });
    expect(q.entries).toEqual([]);
    expect(q.nextLearningDue).toBe(at(25 * MINUTE));
  });

  it('honours new/day and reviews/day, minus what was done today', () => {
    const fresh = Array.from({ length: 5 }, () => candidate({ state: null }));
    const reviews = Array.from({ length: 5 }, (_, k) =>
      candidate({ state: state('review', at(-(k + 1) * DAY)) }),
    );
    const learning = Array.from({ length: 3 }, () =>
      candidate({ state: state('learning', at(-MINUTE)) }),
    );
    const q = buildReviewQueue(
      [...fresh, ...reviews, ...learning],
      decks({
        d1: allow({ newPerDay: 3, newDoneToday: 1, maxReviewsPerDay: 4, reviewsDoneToday: 1 }),
      }),
      { now, timeZone: TZ },
    );
    // Limits never cut learning cards.
    expect(q.counts).toEqual({ learning: 3, review: 3, new: 2 });
    // The most overdue reviews and the oldest new cards are kept.
    const kept = new Set(ids(q));
    expect(reviews.filter((r) => kept.has(r.instanceId))).toEqual(reviews.slice(2));
    expect(fresh.filter((f) => kept.has(f.instanceId))).toEqual(fresh.slice(0, 2));
  });

  it('never goes below zero when more was done than the limit', () => {
    const q = buildReviewQueue(
      [candidate({ state: null }), candidate({ state: state('review', at(-DAY)) })],
      decks({ d1: allow({ newPerDay: 1, newDoneToday: 4, maxReviewsPerDay: 0 }) }),
      { now, timeZone: TZ },
    );
    expect(q.entries).toEqual([]);
  });

  it('applies limits per deck when studying every deck', () => {
    const a = [candidate({ state: null }), candidate({ state: null })];
    const b = [candidate({ state: null, deckId: 'd2' }), candidate({ state: null, deckId: 'd2' })];
    const orphan = candidate({ state: null, deckId: 'gone' });
    const q = buildReviewQueue(
      [...a, ...b, orphan],
      decks({ d1: allow({ newPerDay: 1 }), d2: allow({ newPerDay: 2 }) }),
      { now, timeZone: TZ },
    );
    expect(ids(q)).toEqual([a[0].instanceId, b[0].instanceId, b[1].instanceId]);
  });

  it('shows new cards in the order they were added, cloze numbers in number order', () => {
    const created = at(-DAY);
    const c10 = candidate({ state: null, cardId: 'x', subKey: 'c10', cardCreatedAt: created });
    const c2 = candidate({ state: null, cardId: 'x', subKey: 'c2', cardCreatedAt: created });
    const c1 = candidate({ state: null, cardId: 'x', subKey: 'c1', cardCreatedAt: created });
    const older = candidate({ state: null, cardCreatedAt: at(-2 * DAY) });
    const q = buildReviewQueue([c10, c2, c1, older], decks({ d1: allow() }), {
      now,
      timeZone: TZ,
    });
    expect(ids(q)).toEqual([older, c1, c2, c10].map((c) => c.instanceId));
  });

  it('treats a state row marked new as a new card', () => {
    const reset = candidate({ state: { ...newCardState(now), state: 'new' } });
    const q = buildReviewQueue([reset], decks({ d1: allow() }), { now, timeZone: TZ });
    expect(q.entries).toEqual([expect.objectContaining({ kind: 'new' })]);
  });

  it('hides buried cards until their day begins', () => {
    const buried = candidate({ state: null, buriedUntil: '2026-10-10' });
    const back = candidate({ state: null, buriedUntil: '2026-10-09' });
    const q = buildReviewQueue([buried, back], decks({ d1: allow() }), { now, timeZone: TZ });
    expect(ids(q)).toEqual([back.instanceId]);
    // At 03:00 local on 10 Oct the buried card is back.
    const next = buildReviewQueue([buried], decks({ d1: allow() }), {
      now: '2026-10-10T00:00:00Z',
      timeZone: TZ,
    });
    expect(ids(next)).toEqual([buried.instanceId]);
  });
});
