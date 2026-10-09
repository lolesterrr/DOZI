import { createFolder, deleteFolder, restoreFolders } from '@/features/library/repo';
import { createTestDatabase } from '@/test-utils/db';

import type { CardDraft } from '../logic';
import {
  createCard,
  createDeck,
  deckCounts,
  deckListQuery,
  deleteCard,
  deleteDeck,
  getCard,
  getDeck,
  listCardInstances,
  listCards,
  listDecks,
  moveDeck,
  renameDeck,
  restoreCard,
  restoreDeck,
  setDeckPinned,
  updateCard,
  updateDeckSettings,
} from '../repo';

// SAMPLE content for tests only — made-up words, no drug facts.
const owner = 'owner-1';
const at = (time: string) => ({ now: () => time });
const minutes = (n: number) => new Date(Date.UTC(2026, 9, 9, 10, n)).toISOString();

let ids = 0;
const newId = () => `id-${++ids}`;

const draft = (type: CardDraft['type'], front: string, back = '', extra = ''): CardDraft => ({
  type,
  front: { text: front, mediaIds: [] },
  back: { text: back, mediaIds: [] },
  extra: { text: extra, mediaIds: [] },
});

async function setup() {
  const db = createTestDatabase();
  const deck = await createDeck(
    db,
    { ownerId: owner, title: ' SAMPLE  deck ' },
    { newId, now: () => minutes(0) },
  );
  return { db, deck };
}

const keys = (rows: { subKey: string }[]) => rows.map((r) => r.subKey).sort();

describe('decks', () => {
  it('creates a deck with the default settings', async () => {
    const { db, deck } = await setup();
    expect(deck).toMatchObject({
      ownerId: owner,
      title: 'SAMPLE deck',
      folderId: null,
      source: 'user',
      visibility: 'private',
      pinned: false,
      newPerDay: 15,
      maxReviewsPerDay: 200,
      desiredRetention: 0.9,
      dirty: true,
      deletedAt: null,
    });
    expect(await listDecks(db, owner)).toHaveLength(1);
    expect(await listDecks(db, 'someone-else')).toHaveLength(0);
  });

  it('lists decks for the Library with their number of live cards', async () => {
    const { db, deck } = await setup();
    const other = await createDeck(db, { ownerId: owner, title: 'Empty' }, { newId });
    const basic = draft('basic', 'f', 'b');
    await createCard(db, { ownerId: owner, deckId: deck.id, draft: basic }, { newId });
    const gone = await createCard(db, { ownerId: owner, deckId: deck.id, draft: basic }, { newId });
    await createCard(db, { ownerId: owner, deckId: deck.id, draft: basic }, { newId });
    await deleteCard(db, gone.id);
    const rows = await deckListQuery(db, owner);
    expect(new Map(rows.map((r) => [r.id, r.cardCount]))).toEqual(
      new Map([
        [deck.id, 2],
        [other.id, 0],
      ]),
    );
  });

  it('refuses a deck with no name', async () => {
    const db = createTestDatabase();
    await expect(createDeck(db, { ownerId: owner, title: '  ' })).rejects.toThrow();
  });

  it('renames, pins, moves and saves settings', async () => {
    const { db, deck } = await setup();
    await renameDeck(db, deck.id, '  New   name ', at(minutes(1)));
    await setDeckPinned(db, deck.id, true);
    await moveDeck(db, deck.id, 'folder-1');
    await updateDeckSettings(db, deck.id, {
      newPerDay: 5,
      maxReviewsPerDay: 50,
      desiredRetention: 0.85,
    });
    expect(await getDeck(db, deck.id)).toMatchObject({
      title: 'New name',
      pinned: true,
      folderId: 'folder-1',
      newPerDay: 5,
      maxReviewsPerDay: 50,
      desiredRetention: 0.85,
    });
  });
});

describe('cards and instances', () => {
  it('a cloze card with c1 and c2 makes 2 reviewable instances (roadmap "done when")', async () => {
    const { db, deck } = await setup();
    const card = await createCard(
      db,
      {
        ownerId: owner,
        deckId: deck.id,
        draft: draft('cloze', 'The {{c1::first}} and {{c2::second}} word'),
      },
      { newId, now: () => minutes(1) },
    );
    expect(card).toMatchObject({
      type: 'cloze',
      frontText: 'The first and second word',
      backText: '',
    });
    const instances = await listCardInstances(db, card.id);
    expect(keys(instances)).toEqual(['c1', 'c2']);
    expect(instances.every((i) => i.ownerId === owner && i.dirty && i.deletedAt === null)).toBe(
      true,
    );
    expect((await deckCounts(db, owner)).get(deck.id)).toEqual({ cards: 1, instances: 2 });
  });

  it('makes one instance for basic and type-in, two for basic + reverse', async () => {
    const { db, deck } = await setup();
    const basic = await createCard(
      db,
      { ownerId: owner, deckId: deck.id, draft: draft('basic', 'f', 'b') },
      { newId },
    );
    const reverse = await createCard(
      db,
      { ownerId: owner, deckId: deck.id, draft: draft('basic_reverse', 'f', 'b') },
      { newId },
    );
    const typeIn = await createCard(
      db,
      { ownerId: owner, deckId: deck.id, draft: draft('type_in', 'q', 'answer') },
      { newId },
    );
    expect(keys(await listCardInstances(db, basic.id))).toEqual(['front']);
    expect(keys(await listCardInstances(db, reverse.id))).toEqual(['front', 'reverse']);
    expect(keys(await listCardInstances(db, typeIn.id))).toEqual(['front']);
    expect((await deckCounts(db, owner)).get(deck.id)).toEqual({ cards: 3, instances: 4 });
  });

  it('refuses a card that is not ready', async () => {
    const { db, deck } = await setup();
    await expect(
      createCard(db, { ownerId: owner, deckId: deck.id, draft: draft('cloze', 'no clozes') }),
    ).rejects.toThrow();
    expect(await listCards(db, deck.id)).toHaveLength(0);
  });

  it('keeps instance rows by key when a card is edited, and revives a removed number', async () => {
    const { db, deck } = await setup();
    const card = await createCard(
      db,
      { ownerId: owner, deckId: deck.id, draft: draft('cloze', '{{c1::a}} {{c2::b}}') },
      { newId },
    );
    const [c1, c2] = await listCardInstances(db, card.id);

    // Change c1's text and drop c2.
    await updateCard(db, card.id, draft('cloze', '{{c1::changed}}'), {
      newId,
      now: () => minutes(2),
    });
    let live = await listCardInstances(db, card.id);
    expect(live.map((i) => i.id)).toEqual([c1.id]);
    expect((await getCard(db, card.id))?.frontText).toBe('changed');

    // Bring c2 back and add c3: c2 is the same row as before.
    await updateCard(db, card.id, draft('cloze', '{{c1::a}} {{c2::b}} {{c3::c}}'), {
      newId,
      now: () => minutes(3),
    });
    live = await listCardInstances(db, card.id);
    expect(keys(live)).toEqual(['c1', 'c2', 'c3']);
    expect(live.find((i) => i.subKey === 'c2')?.id).toBe(c2.id);
  });

  it('changing the type updates the instances', async () => {
    const { db, deck } = await setup();
    const card = await createCard(
      db,
      { ownerId: owner, deckId: deck.id, draft: draft('basic', 'f', 'b') },
      { newId },
    );
    const [front] = await listCardInstances(db, card.id);
    await updateCard(db, card.id, draft('basic_reverse', 'f', 'b'), { newId });
    const live = await listCardInstances(db, card.id);
    expect(keys(live)).toEqual(['front', 'reverse']);
    expect(live.find((i) => i.subKey === 'front')?.id).toBe(front.id);
  });

  it('adding a card moves the deck up in "Recently changed"', async () => {
    const { db, deck } = await setup();
    await createCard(
      db,
      { ownerId: owner, deckId: deck.id, draft: draft('basic', 'f', 'b') },
      { newId, now: () => minutes(5) },
    );
    expect((await getDeck(db, deck.id))?.updatedAt).toBe(minutes(5));
  });

  it('deletes a card with its instances, and undo brings back exactly those', async () => {
    const { db, deck } = await setup();
    const card = await createCard(
      db,
      { ownerId: owner, deckId: deck.id, draft: draft('cloze', '{{c1::a}} {{c2::b}}') },
      { newId },
    );
    // c2 was removed earlier, separately: undoing the card delete must not bring it back.
    await updateCard(db, card.id, draft('cloze', '{{c1::a}}'), { newId, now: () => minutes(1) });
    const deletedAt = await deleteCard(db, card.id, at(minutes(2)));
    expect(await listCards(db, deck.id)).toHaveLength(0);
    expect(await listCardInstances(db, card.id)).toHaveLength(0);

    await restoreCard(db, card.id, deletedAt, at(minutes(3)));
    expect(await listCards(db, deck.id)).toHaveLength(1);
    expect(keys(await listCardInstances(db, card.id))).toEqual(['c1']);
  });

  it('deleting a deck deletes its cards; undo restores them', async () => {
    const { db, deck } = await setup();
    const card = await createCard(
      db,
      { ownerId: owner, deckId: deck.id, draft: draft('basic_reverse', 'f', 'b') },
      { newId },
    );
    const deletedAt = await deleteDeck(db, deck.id, at(minutes(4)));
    expect(await listDecks(db, owner)).toHaveLength(0);
    expect(await listCards(db, deck.id)).toHaveLength(0);
    expect(await listCardInstances(db, card.id)).toHaveLength(0);

    await restoreDeck(db, deck.id, deletedAt, at(minutes(5)));
    expect(await listDecks(db, owner)).toHaveLength(1);
    expect(await listCards(db, deck.id)).toHaveLength(1);
    expect(keys(await listCardInstances(db, card.id))).toEqual(['front', 'reverse']);
  });

  it('deleting a Decks folder deletes the decks in it; undo restores them', async () => {
    const db = createTestDatabase();
    const folder = await createFolder(db, {
      ownerId: owner,
      kind: 'deck',
      name: 'ANS',
      parentId: null,
    });
    const inner = await createFolder(db, {
      ownerId: owner,
      kind: 'deck',
      name: 'Inner',
      parentId: folder.id,
    });
    const deck = await createDeck(
      db,
      { ownerId: owner, folderId: inner.id, title: 'SAMPLE deck' },
      { newId },
    );
    const outside = await createDeck(db, { ownerId: owner, title: 'Elsewhere' }, { newId });
    const card = await createCard(
      db,
      { ownerId: owner, deckId: deck.id, draft: draft('basic', 'f', 'b') },
      { newId },
    );

    const deleted = await deleteFolder(db, folder.id, at(minutes(6)));
    expect((await listDecks(db, owner)).map((d) => d.id)).toEqual([outside.id]);
    expect(await listCardInstances(db, card.id)).toHaveLength(0);

    await restoreFolders(db, deleted, at(minutes(7)));
    expect(await listDecks(db, owner)).toHaveLength(2);
    expect(await listCards(db, deck.id)).toHaveLength(1);
    expect(await listCardInstances(db, card.id)).toHaveLength(1);
  });
});
