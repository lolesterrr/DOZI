import {
  createCard,
  createDeck,
  deleteCard,
  listCardInstances,
  setCardSuspended,
} from '@/features/decks/repo';
import type { CardDraft } from '@/features/decks/logic';
import {
  answerCard,
  buryCard,
  getCardState,
  loadReviewQueue,
  rebuildCardState,
  unburyCard,
} from '@/features/srs/repo';
import { createTestDatabase } from '@/test-utils/db';

import { loadCramCards, loadReviewItem } from '../repo';

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

const field = (text: string) => ({ text, mediaIds: [] });
const basic = (front: string): CardDraft => ({
  type: 'basic',
  front: field(front),
  back: field('SAMPLE answer'),
  extra: field(''),
});
const cloze: CardDraft = {
  type: 'cloze',
  front: field('SAMPLE {{c1::one}} and {{c2::two}}'),
  back: field(''),
  extra: field(''),
};

async function setup() {
  const db = createTestDatabase();
  const deck = await createDeck(
    db,
    { ownerId: owner, title: 'SAMPLE deck' },
    { newId, ...clock(-DAY) },
  );
  const other = await createDeck(
    db,
    { ownerId: owner, title: 'SAMPLE other' },
    { newId, ...clock(-DAY) },
  );
  const first = await createCard(
    db,
    { ownerId: owner, deckId: deck.id, draft: basic('SAMPLE first') },
    { newId, now: () => at(-DAY) },
  );
  const second = await createCard(
    db,
    { ownerId: owner, deckId: deck.id, draft: cloze },
    { newId, now: () => at(-DAY + MINUTE) },
  );
  const elsewhere = await createCard(
    db,
    { ownerId: owner, deckId: other.id, draft: basic('SAMPLE elsewhere') },
    { newId, now: () => at(-DAY + 2 * MINUTE) },
  );
  const instance = async (cardId: string) => (await listCardInstances(db, cardId)).map((i) => i.id);
  return {
    db,
    deck,
    other,
    first,
    second,
    elsewhere,
    firstInstance: (await instance(first.id))[0],
    clozeInstances: await instance(second.id),
  };
}

const queueIds = async (db: ReturnType<typeof createTestDatabase>, ms: number) =>
  (
    await loadReviewQueue(db, { ownerId: owner, scope: 'all', timeZone: TZ }, clock(ms))
  ).entries.map((e) => e.instanceId);

describe('loadReviewItem', () => {
  it('returns the card, its deck settings and its state', async () => {
    const { db, deck, firstInstance } = await setup();
    const item = await loadReviewItem(db, firstInstance);
    expect(item).toMatchObject({
      instanceId: firstInstance,
      subKey: 'front',
      deckId: deck.id,
      deckTitle: 'SAMPLE deck',
      desiredRetention: 0.9,
      state: null,
    });
    expect(item?.card.frontText).toBe('SAMPLE first');

    await answerCard(db, { instanceId: firstInstance, rating: 3 }, { newId, ...clock(0) });
    expect((await loadReviewItem(db, firstInstance))?.state).toMatchObject({ state: 'learning' });
  });

  it('returns null for a deleted card', async () => {
    const { db, first, firstInstance } = await setup();
    await deleteCard(db, first.id);
    expect(await loadReviewItem(db, firstInstance)).toBeNull();
  });
});

describe('loadCramCards', () => {
  it('lists every card of the deck in the order added, due or not', async () => {
    const { db, deck, first, second, firstInstance, clozeInstances } = await setup();
    await answerCard(db, { instanceId: firstInstance, rating: 4 }, { newId, ...clock(0) });
    const cards = await loadCramCards(db, { ownerId: owner, scope: { deckId: deck.id } });
    expect(cards).toEqual([
      { instanceId: firstInstance, cardId: first.id, deckId: deck.id, kind: 'review' },
      { instanceId: clozeInstances[0], cardId: second.id, deckId: deck.id, kind: 'new' },
      { instanceId: clozeInstances[1], cardId: second.id, deckId: deck.id, kind: 'new' },
    ]);
    expect(await loadCramCards(db, { ownerId: owner, scope: 'all' })).toHaveLength(4);
  });

  it('leaves out suspended and deleted cards', async () => {
    const { db, deck, first, second } = await setup();
    await setCardSuspended(db, first.id, true);
    await deleteCard(db, second.id);
    expect(await loadCramCards(db, { ownerId: owner, scope: { deckId: deck.id } })).toEqual([]);
  });
});

describe('suspend', () => {
  it('takes every instance of the card out of reviews until brought back', async () => {
    const { db, second, clozeInstances } = await setup();
    expect(await queueIds(db, 0)).toEqual(expect.arrayContaining(clozeInstances));
    await setCardSuspended(db, second.id, true);
    const ids = await queueIds(db, 0);
    expect(ids).not.toContain(clozeInstances[0]);
    expect(ids).not.toContain(clozeInstances[1]);
    await setCardSuspended(db, second.id, false);
    expect(await queueIds(db, 0)).toEqual(expect.arrayContaining(clozeInstances));
  });
});

describe('bury', () => {
  it('hides a new card until the next study day starts (03:00)', async () => {
    const { db, firstInstance } = await setup();
    await buryCard(db, firstInstance, '2026-10-10', clock(0));
    expect(await queueIds(db, 0)).not.toContain(firstInstance);
    // The card stays new: burying changes nothing in its schedule.
    expect(await getCardState(db, firstInstance)).toMatchObject({ state: 'new', reps: 0 });
    // 02:30 on 10 Oct is still 9 Oct's study day; 03:00 is the next one.
    expect(await queueIds(db, 16.5 * 60 * MINUTE)).not.toContain(firstInstance);
    expect(await queueIds(db, 17 * 60 * MINUTE)).toContain(firstInstance);
  });

  it('keeps the schedule of a reviewed card, and can be undone', async () => {
    const { db, firstInstance } = await setup();
    const { state } = await answerCard(
      db,
      { instanceId: firstInstance, rating: 1 },
      { newId, ...clock(0) },
    );
    await buryCard(db, firstInstance, '2026-10-10', clock(MINUTE));
    expect(await getCardState(db, firstInstance)).toEqual(state);
    expect(await queueIds(db, 2 * MINUTE)).not.toContain(firstInstance);
    await unburyCard(db, firstInstance);
    expect(await queueIds(db, 2 * MINUTE)).toContain(firstInstance);
  });

  it('a new card answered after its bury is scheduled like any new card', async () => {
    const { db, firstInstance } = await setup();
    await buryCard(db, firstInstance, '2026-10-10', clock(0));
    const { state } = await answerCard(
      db,
      { instanceId: firstInstance, rating: 3 },
      { newId, ...clock(DAY) },
    );
    expect(state).toMatchObject({ state: 'learning', reps: 1, due: at(DAY + 10 * MINUTE) });
    // Replaying the log (sync, undo) gives the same state.
    expect(await rebuildCardState(db, firstInstance)).toEqual(state);
  });
});
