import { and, eq, isNull } from 'drizzle-orm';

import { cardState, reviewLogs, streakState, xpEvents } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { createCard, createDeck, listCardInstances } from '@/features/decks/repo';
import { refreshStreak } from '@/features/gamification/repo';
import { ensureProfile } from '@/features/profile/repo';
import { replayReviews, type ReviewRating } from '@/features/srs/logic';
import { answerCard, getCardState, rebuildAfterSync, undoAnswer } from '@/features/srs/repo';
import { createTestDatabase } from '@/test-utils/db';
import { createFakeServer } from '@/test-utils/fakeSyncServer';

import { runSync } from '../engine';

// Task 3.4: answers and XP from two phones merge into one schedule and one streak.
// SAMPLE content for tests only, no drug facts.

const USER = '00000000-0000-4000-a000-00000000000a';
let tick = Date.parse('2026-11-05T10:00:00.000Z');
const now = () => new Date((tick += 1000)).toISOString();
let ids = 0;
const newId = () => `00000000-0000-4000-b000-${String(++ids).padStart(12, '0')}`;

async function phone(): Promise<AppDatabase> {
  const db = createTestDatabase();
  await ensureProfile(db, { newId: () => USER, now: () => '2026-10-01T09:00:00.000Z' });
  return db;
}

const sync = (db: AppDatabase, server: ReturnType<typeof createFakeServer>) =>
  runSync(db, server.transport, USER, { now });

/** Phone A makes a SAMPLE deck with one card; phone B gets it by syncing. */
async function twoPhonesWithACard() {
  const server = createFakeServer();
  const a = await phone();
  const deck = await createDeck(
    a,
    { ownerId: USER, title: 'SAMPLE deck' },
    { newId, now: () => '2026-10-20T08:00:00.000Z' },
  );
  const card = await createCard(
    a,
    {
      ownerId: USER,
      deckId: deck.id,
      draft: {
        type: 'basic',
        front: { text: 'SAMPLE front', mediaIds: [] },
        back: { text: 'SAMPLE back', mediaIds: [] },
        extra: { text: '', mediaIds: [] },
      },
    },
    { newId, now: () => '2026-10-20T08:01:00.000Z' },
  );
  const instanceId = (await listCardInstances(a, card.id))[0].id;
  await sync(a, server);
  const b = await phone();
  await sync(b, server);
  return { server, a, b, instanceId, deck };
}

/** One more round each, then a further round must send nothing (no endless back and forth). */
async function settle(a: AppDatabase, b: AppDatabase, server: ReturnType<typeof createFakeServer>) {
  await sync(b, server);
  await sync(a, server);
  expect((await sync(b, server)).pushed).toBe(0);
  expect((await sync(a, server)).pushed).toBe(0);
}

const answer = (db: AppDatabase, instanceId: string, rating: ReviewRating, at: string) =>
  answerCard(db, { instanceId, rating }, { newId, now: () => at });

const liveLogs = (db: AppDatabase, instanceId: string) =>
  db
    .select()
    .from(reviewLogs)
    .where(and(eq(reviewLogs.cardInstanceId, instanceId), isNull(reviewLogs.deletedAt)))
    .all();

describe('replaying reviews after a sync', () => {
  it('merges interleaved offline answers from two phones into one schedule', async () => {
    const { server, a, b, instanceId, deck } = await twoPhonesWithACard();

    // Both offline, answers interleaved in time: A, B, A, B.
    await answer(a, instanceId, 3, '2026-11-01T07:00:00.000Z');
    await answer(b, instanceId, 3, '2026-11-01T07:20:00.000Z');
    await answer(a, instanceId, 1, '2026-11-02T07:00:00.000Z');
    await answer(b, instanceId, 4, '2026-11-04T07:00:00.000Z');

    await sync(a, server);
    await sync(b, server);
    await sync(a, server);

    // The right answer: all four answers replayed through FSRS in the order they were given.
    const expected = replayReviews(
      [
        { rating: 3, reviewedAt: '2026-11-01T07:00:00.000Z' },
        { rating: 3, reviewedAt: '2026-11-01T07:20:00.000Z' },
        { rating: 1, reviewedAt: '2026-11-02T07:00:00.000Z' },
        { rating: 4, reviewedAt: '2026-11-04T07:00:00.000Z' },
      ],
      { desiredRetention: deck.desiredRetention },
    );
    expect(expected).toMatchObject({ reps: 4, lapses: 1 });
    for (const db of [a, b]) {
      expect(liveLogs(db, instanceId)).toHaveLength(4);
      expect(await getCardState(db, instanceId)).toEqual(expected);
    }

    // Each phone sends its rebuilt schedule once; after that they agree and nothing more moves.
    await settle(a, b, server);
    for (const db of [a, b]) expect(await getCardState(db, instanceId)).toEqual(expected);
    expect(server.rows('card_state')).toEqual([
      expect.objectContaining({ card_instance_id: instanceId, reps: 4, lapses: 1 }),
    ]);
  });

  it('gives the same schedule whichever phone syncs first', async () => {
    const { server, a, b, instanceId } = await twoPhonesWithACard();
    await answer(b, instanceId, 3, '2026-11-01T07:00:00.000Z');
    await answer(a, instanceId, 2, '2026-11-01T09:00:00.000Z');
    await answer(b, instanceId, 3, '2026-11-03T07:00:00.000Z');

    await sync(b, server);
    await sync(a, server);
    await sync(b, server);

    const stateA = await getCardState(a, instanceId);
    expect(stateA).toMatchObject({ reps: 3 });
    expect(await getCardState(b, instanceId)).toEqual(stateA);
  });

  it('takes an undo made on the other phone', async () => {
    const { server, a, b, instanceId } = await twoPhonesWithACard();
    await answer(a, instanceId, 3, '2026-11-01T07:00:00.000Z');
    const second = await answer(a, instanceId, 1, '2026-11-01T07:20:00.000Z');
    await sync(a, server);
    await sync(b, server);
    expect(await getCardState(b, instanceId)).toMatchObject({ reps: 2 });

    await undoAnswer(a, second.logId, { now: () => '2026-11-01T07:21:00.000Z' });
    await sync(a, server);
    await sync(b, server);

    expect(liveLogs(b, instanceId)).toHaveLength(1);
    expect(await getCardState(b, instanceId)).toEqual(await getCardState(a, instanceId));
    expect(await getCardState(b, instanceId)).toMatchObject({ reps: 1, lapses: 0 });
  });

  it('works out the streak again from both phones’ XP', async () => {
    const server = createFakeServer();
    const a = await phone();
    const b = await phone();
    const xp = (db: AppDatabase, id: string, day: string) => {
      db.insert(xpEvents)
        .values({
          id,
          ownerId: USER,
          studyDay: day,
          source: 'review_card',
          amount: 20,
          createdAt: `${day}T08:00:00.000Z`,
          updatedAt: `${day}T08:00:00.000Z`,
        })
        .run();
    };
    // Offline: A studied yesterday, B studied today. Each phone alone sees a 1-day streak.
    xp(a, newId(), '2026-11-04');
    xp(b, newId(), '2026-11-05');
    expect((await refreshStreak(a, USER, { now })).current).toBe(1);
    expect((await refreshStreak(b, USER, { now })).current).toBe(1);

    await sync(a, server);
    await sync(b, server);
    await sync(a, server);

    for (const db of [a, b]) {
      expect(
        db.select().from(streakState).where(eq(streakState.ownerId, USER)).get(),
      ).toMatchObject({ current: 2, longest: 2, lastCountedDay: '2026-11-05' });
    }
    await settle(a, b, server);
  });
});

describe('rebuildAfterSync', () => {
  it('skips cards that are not on the phone and leaves a card with no answers alone', async () => {
    const { a, instanceId } = await twoPhonesWithACard();
    expect(await rebuildAfterSync(a, ['not-here', instanceId], { now })).toBe(0);
    expect(a.select().from(cardState).all()).toHaveLength(0);
  });

  it('writes only when the replayed schedule differs', async () => {
    const { a, instanceId } = await twoPhonesWithACard();
    await answer(a, instanceId, 3, '2026-11-01T07:00:00.000Z');
    expect(await rebuildAfterSync(a, [instanceId], { now })).toBe(0);

    // A stale schedule (as if the other phone's older copy arrived) is put right.
    a.update(cardState)
      .set({ reps: 9, dirty: false })
      .where(eq(cardState.cardInstanceId, instanceId))
      .run();
    expect(await rebuildAfterSync(a, [instanceId], { now })).toBe(1);
    expect(await getCardState(a, instanceId)).toMatchObject({ reps: 1 });
    expect(a.select().from(cardState).get()).toMatchObject({ dirty: true });
  });
});
