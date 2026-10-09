import { eq } from 'drizzle-orm';

import { cards, reviewLogs } from '@/db/schema';
import {
  createCard,
  createDeck,
  deleteCard,
  deleteDeck,
  listCardInstances,
  updateDeckSettings,
} from '@/features/decks/repo';
import type { CardDraft } from '@/features/decks/logic';
import { createTestDatabase } from '@/test-utils/db';

import { replayReviews, reviewCard } from '../logic';
import {
  answerCard,
  getCardState,
  loadReviewQueue,
  rebuildCardState,
  undoAnswer,
  type ReviewScope,
} from '../repo';

// SAMPLE content for tests only — made-up words, no drug facts.
const owner = 'owner-1';
const TZ = 'Africa/Kampala';
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** 10:00 in Kampala on 9 Oct 2026. */
const start = Date.parse('2026-10-09T07:00:00Z');
const at = (ms: number) => new Date(start + ms).toISOString();
const clock = (ms: number) => ({ now: () => at(ms) });

let ids = 0;
const newId = () => `id-${String(++ids).padStart(4, '0')}`;

const basic = (front: string): CardDraft => ({
  type: 'basic',
  front: { text: front, mediaIds: [] },
  back: { text: 'SAMPLE answer', mediaIds: [] },
  extra: { text: '', mediaIds: [] },
});

async function setup(cardCount = 3) {
  const db = createTestDatabase();
  const deck = await createDeck(
    db,
    { ownerId: owner, title: 'SAMPLE deck' },
    { newId, ...clock(-DAY) },
  );
  const instances: string[] = [];
  const cardIds: string[] = [];
  for (let k = 0; k < cardCount; k++) {
    const card = await createCard(
      db,
      { ownerId: owner, deckId: deck.id, draft: basic(`SAMPLE ${k}`) },
      { newId, now: () => at(-DAY + k * MINUTE) },
    );
    cardIds.push(card.id);
    instances.push((await listCardInstances(db, card.id))[0].id);
  }
  return { db, deck, instances, cardIds };
}

const queue = (db: Parameters<typeof loadReviewQueue>[0], ms: number, scope: ReviewScope = 'all') =>
  loadReviewQueue(db, { ownerId: owner, scope, timeZone: TZ }, clock(ms));

describe('answerCard', () => {
  it('stores a log and the new state; the card leaves the queue until due', async () => {
    const { db, instances } = await setup(1);
    expect((await queue(db, 0)).counts).toEqual({ learning: 0, review: 0, new: 1 });

    const result = await answerCard(
      db,
      { instanceId: instances[0], rating: 3, durationMs: 4200.4 },
      { newId, ...clock(0) },
    );
    expect(result.state).toMatchObject({ state: 'learning', reps: 1, due: at(10 * MINUTE) });
    expect(await getCardState(db, instances[0])).toEqual(result.state);

    const [log] = await db.select().from(reviewLogs);
    expect(log).toMatchObject({
      id: result.logId,
      ownerId: owner,
      cardInstanceId: instances[0],
      rating: 3,
      state: 'new',
      reviewDurationMs: 4200,
      reviewedAt: at(0),
      deletedAt: null,
      dirty: true,
    });

    // Learn-ahead (20 min) keeps it in today's session; after that it is only "next due".
    const soon = await queue(db, MINUTE);
    expect(soon.entries).toEqual([
      expect.objectContaining({ instanceId: instances[0], kind: 'learning' }),
    ]);

    const graduated = await answerCard(
      db,
      { instanceId: instances[0], rating: 3 },
      { newId, ...clock(10 * MINUTE) },
    );
    expect(graduated.state.state).toBe('review');
    expect((await queue(db, 11 * MINUTE)).entries).toEqual([]);
    const due = Date.parse(graduated.state.due) - start;
    expect((await queue(db, due)).entries).toEqual([
      expect.objectContaining({ instanceId: instances[0], kind: 'review' }),
    ]);
  });

  it('uses the deck’s desired retention', async () => {
    const { db, deck, instances } = await setup(2);
    await updateDeckSettings(db, deck.id, {
      newPerDay: 15,
      maxReviewsPerDay: 200,
      desiredRetention: 0.97,
    });
    let strict = null;
    let expected = null;
    for (const [k, rating] of [3, 3, 3].entries()) {
      const when = k * 5 * DAY;
      strict = (
        await answerCard(
          db,
          { instanceId: instances[0], rating: rating as 3 },
          { newId, ...clock(when) },
        )
      ).state;
      expected = reviewCard(expected, 3, at(when), { desiredRetention: 0.97 }).next;
    }
    expect(strict).toEqual(expected);
  });

  it('refuses a card that is not there', async () => {
    const { db } = await setup(0);
    await expect(answerCard(db, { instanceId: 'nope', rating: 3 }, { newId })).rejects.toThrow();
  });
});

describe('loadReviewQueue', () => {
  it('keeps to the deck’s new cards per day, and gives more the next study day', async () => {
    const { db, deck, instances } = await setup(4);
    await updateDeckSettings(db, deck.id, {
      newPerDay: 2,
      maxReviewsPerDay: 200,
      desiredRetention: 0.9,
    });
    const first = await queue(db, 0, { deckId: deck.id });
    expect(first.entries.map((e) => e.instanceId)).toEqual(instances.slice(0, 2));

    await answerCard(db, { instanceId: instances[0], rating: 4 }, { newId, ...clock(MINUTE) });
    await answerCard(db, { instanceId: instances[1], rating: 4 }, { newId, ...clock(2 * MINUTE) });
    expect((await queue(db, 3 * MINUTE)).counts.new).toBe(0);

    // 02:59 local is still the same study day; 03:00 starts a new one.
    expect((await queue(db, 17 * 60 * MINUTE - MINUTE)).counts.new).toBe(0);
    const tomorrow = await queue(db, 17 * 60 * MINUTE);
    expect(tomorrow.entries.filter((e) => e.kind === 'new').map((e) => e.instanceId)).toEqual(
      instances.slice(2),
    );
  });

  it('keeps to the deck’s reviews per day', async () => {
    const { db, deck, instances } = await setup(3);
    for (const id of instances) {
      await answerCard(db, { instanceId: id, rating: 4 }, { newId, ...clock(0) });
    }
    await updateDeckSettings(db, deck.id, {
      newPerDay: 15,
      maxReviewsPerDay: 2,
      desiredRetention: 0.9,
    });
    const later = 60 * DAY;
    const q = await queue(db, later);
    expect(q.counts.review).toBe(2);
    await answerCard(
      db,
      { instanceId: q.entries[0].instanceId, rating: 3 },
      { newId, ...clock(later) },
    );
    expect((await queue(db, later + MINUTE)).counts.review).toBe(1);
  });

  it('leaves out suspended, deleted and other decks’ cards', async () => {
    const { db, deck, instances, cardIds } = await setup(3);
    const other = await createDeck(
      db,
      { ownerId: owner, title: 'SAMPLE other' },
      { newId, ...clock(0) },
    );
    const card = await createCard(
      db,
      { ownerId: owner, deckId: other.id, draft: basic('SAMPLE x') },
      { newId, ...clock(0) },
    );
    const [otherInstance] = await listCardInstances(db, card.id);
    const ids = async (scope: ReviewScope) =>
      (await queue(db, MINUTE, scope)).entries.map((e) => e.instanceId);

    expect(await ids({ deckId: deck.id })).toEqual(instances);
    expect(await ids('all')).toEqual([...instances, otherInstance.id]);

    await db.update(cards).set({ suspended: true }).where(eq(cards.id, cardIds[0]));
    await deleteCard(db, cardIds[1], clock(0));
    await deleteDeck(db, other.id, clock(0));
    expect(await ids('all')).toEqual([instances[2]]);
  });
});

describe('undoAnswer', () => {
  it('puts the card back exactly as it was', async () => {
    const { db, instances } = await setup(1);
    const id = instances[0];
    await answerCard(db, { instanceId: id, rating: 3 }, { newId, ...clock(0) });
    await answerCard(db, { instanceId: id, rating: 3 }, { newId, ...clock(10 * MINUTE) });
    const before = await getCardState(db, id);
    const queueBefore = await queue(db, 3 * DAY);

    const { logId } = await answerCard(
      db,
      { instanceId: id, rating: 1 },
      { newId, ...clock(3 * DAY) },
    );
    expect((await getCardState(db, id))?.state).toBe('relearning');

    expect(await undoAnswer(db, logId, clock(3 * DAY + MINUTE))).toEqual(before);
    expect(await getCardState(db, id)).toEqual(before);
    expect(await queue(db, 3 * DAY)).toEqual(queueBefore);
    const [log] = await db.select().from(reviewLogs).where(eq(reviewLogs.id, logId));
    expect(log).toMatchObject({ deletedAt: at(3 * DAY + MINUTE), dirty: true });
  });

  it('makes a card new again when its only answer is undone, and frees the new-card slot', async () => {
    const { db, deck, instances } = await setup(2);
    await updateDeckSettings(db, deck.id, {
      newPerDay: 1,
      maxReviewsPerDay: 200,
      desiredRetention: 0.9,
    });
    const { logId } = await answerCard(
      db,
      { instanceId: instances[0], rating: 4 },
      { newId, ...clock(0) },
    );
    expect((await queue(db, MINUTE)).entries).toEqual([]);

    expect(await undoAnswer(db, logId, clock(MINUTE))).toBeNull();
    expect(await getCardState(db, instances[0])).toBeNull();
    expect((await queue(db, MINUTE)).entries).toEqual([
      expect.objectContaining({ instanceId: instances[0], kind: 'new' }),
    ]);
    // Answering again revives the cleared state row.
    await answerCard(db, { instanceId: instances[0], rating: 3 }, { newId, ...clock(2 * MINUTE) });
    expect((await getCardState(db, instances[0]))?.reps).toBe(1);
  });

  it('refuses an answer that is not there', async () => {
    const { db } = await setup(0);
    await expect(undoAnswer(db, 'nope')).rejects.toThrow();
  });
});

describe('rebuildCardState', () => {
  it('merges answers made on another phone into the right order', async () => {
    const { db, instances } = await setup(1);
    const id = instances[0];
    await answerCard(db, { instanceId: id, rating: 3 }, { newId, ...clock(0) });
    await answerCard(db, { instanceId: id, rating: 3 }, { newId, ...clock(10 * MINUTE) });
    await answerCard(db, { instanceId: id, rating: 3 }, { newId, ...clock(6 * DAY) });

    // Sync brings an "Again" given on another phone on day 3, before this phone's last answer.
    const offline = reviewCard(null, 1, at(3 * DAY), { desiredRetention: 0.9 }).log;
    await db.insert(reviewLogs).values({
      id: 'from-other-phone',
      ownerId: owner,
      cardInstanceId: id,
      ...offline,
      createdAt: at(7 * DAY),
      updatedAt: at(7 * DAY),
      dirty: false,
    });

    const expected = replayReviews(
      [
        { rating: 3, reviewedAt: at(0) },
        { rating: 3, reviewedAt: at(10 * MINUTE) },
        { rating: 1, reviewedAt: at(3 * DAY) },
        { rating: 3, reviewedAt: at(6 * DAY) },
      ],
      { desiredRetention: 0.9 },
    );
    expect(await rebuildCardState(db, id, clock(7 * DAY))).toEqual(expected);
    expect(await getCardState(db, id)).toEqual(expected);
    expect(expected?.lapses).toBe(1);
  });

  it('changes nothing when the logs already match', async () => {
    const { db, instances } = await setup(1);
    await answerCard(db, { instanceId: instances[0], rating: 3 }, { newId, ...clock(0) });
    await answerCard(db, { instanceId: instances[0], rating: 2 }, { newId, ...clock(10 * MINUTE) });
    const current = await getCardState(db, instances[0]);
    expect(await rebuildCardState(db, instances[0], clock(DAY))).toEqual(current);
  });
});
