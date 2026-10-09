import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { cardInstances, cards, decks, type Card, type CardInstance, type Deck } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId as defaultNewId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

import {
  cardDraftProblem,
  cleanDeckTitle,
  deckTitleProblem,
  DECK_DESCRIPTION_MAX,
  instanceKeys,
  planInstances,
  summariseDraft,
  tidyDraft,
  type CardDraft,
  type DeckSettings,
} from './logic';

// Decks, cards and card instances (ARCHITECTURE §3.3). Every change marks rows dirty for sync.

type Deps = { newId?: () => string; now?: () => string };
type NowDep = Pick<Deps, 'now'>;

const isoNow = () => nowIso();

// ---------------------------------------------------------------------------------------------
// Decks

/** Every deck of one owner that hasn't been deleted. */
export async function listDecks(db: AppDatabase, ownerId: string): Promise<Deck[]> {
  return db
    .select()
    .from(decks)
    .where(and(eq(decks.ownerId, ownerId), isNull(decks.deletedAt)))
    .orderBy(asc(decks.title));
}

/**
 * The Library's deck rows: every live deck of an owner with its number of cards. A query (not a
 * promise) so the Library can run it as a live query.
 */
export function deckListQuery(db: AppDatabase, ownerId: string) {
  return db
    .select({
      id: decks.id,
      title: decks.title,
      folderId: decks.folderId,
      pinned: decks.pinned,
      createdAt: decks.createdAt,
      updatedAt: decks.updatedAt,
      // Written out by hand: inside a subquery Drizzle would leave the column names unqualified.
      cardCount: sql<number>`(select count(*) from "cards" as "c" where "c"."deck_id" = "decks"."id" and "c"."deleted_at" is null)`,
    })
    .from(decks)
    .where(and(eq(decks.ownerId, ownerId), isNull(decks.deletedAt)));
}

/** One deck, including a deleted one (so its screen can say it's gone). */
export async function getDeck(db: AppDatabase, id: string): Promise<Deck | undefined> {
  const rows = await db.select().from(decks).where(eq(decks.id, id)).limit(1);
  return rows[0];
}

export type NewDeckInput = { ownerId: string; folderId?: string | null; title: string };

export async function createDeck(
  db: AppDatabase,
  input: NewDeckInput,
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<Deck> {
  if (deckTitleProblem(input.title)) throw new Error('A deck needs a title');
  const timestamp = now();
  const [created] = await db
    .insert(decks)
    .values({
      id: newId(),
      ownerId: input.ownerId,
      folderId: input.folderId ?? null,
      title: cleanDeckTitle(input.title),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();
  return created;
}

export async function renameDeck(
  db: AppDatabase,
  id: string,
  title: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  if (deckTitleProblem(title)) throw new Error('A deck needs a title');
  await db
    .update(decks)
    .set({ title: cleanDeckTitle(title), updatedAt: now(), dirty: true })
    .where(eq(decks.id, id));
}

export async function setDeckDescription(
  db: AppDatabase,
  id: string,
  description: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  await db
    .update(decks)
    .set({
      description: description.trim().slice(0, DECK_DESCRIPTION_MAX),
      updatedAt: now(),
      dirty: true,
    })
    .where(eq(decks.id, id));
}

export async function updateDeckSettings(
  db: AppDatabase,
  id: string,
  settings: DeckSettings,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  await db
    .update(decks)
    .set({ ...settings, updatedAt: now(), dirty: true })
    .where(eq(decks.id, id));
}

export async function setDeckPinned(
  db: AppDatabase,
  id: string,
  pinned: boolean,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  await db.update(decks).set({ pinned, updatedAt: now(), dirty: true }).where(eq(decks.id, id));
}

/** Moves a deck into a Decks folder, or to the top level (null). */
export async function moveDeck(
  db: AppDatabase,
  id: string,
  folderId: string | null,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  await db.update(decks).set({ folderId, updatedAt: now(), dirty: true }).where(eq(decks.id, id));
}

/**
 * Soft-deletes decks with their cards and card instances, all with the same `deletedAt`, so
 * `restoreDeckRows` can undo exactly this delete. Rows deleted earlier are left alone.
 */
async function softDeleteDeckRows(db: AppDatabase, deckIds: string[], deletedAt: string) {
  if (deckIds.length === 0) return;
  const set = { deletedAt, updatedAt: deletedAt, dirty: true };
  await db
    .update(decks)
    .set(set)
    .where(and(inArray(decks.id, deckIds), isNull(decks.deletedAt)));
  await db
    .update(cardInstances)
    .set(set)
    .where(
      and(
        isNull(cardInstances.deletedAt),
        inArray(
          cardInstances.cardId,
          db
            .select({ id: cards.id })
            .from(cards)
            .where(and(inArray(cards.deckId, deckIds), isNull(cards.deletedAt))),
        ),
      ),
    );
  await db
    .update(cards)
    .set(set)
    .where(and(inArray(cards.deckId, deckIds), isNull(cards.deletedAt)));
}

async function restoreDeckRows(
  db: AppDatabase,
  deckIds: string[],
  deletedAt: string,
  timestamp: string,
) {
  if (deckIds.length === 0) return;
  const set = { deletedAt: null, updatedAt: timestamp, dirty: true };
  await db
    .update(decks)
    .set(set)
    .where(and(inArray(decks.id, deckIds), eq(decks.deletedAt, deletedAt)));
  await db
    .update(cardInstances)
    .set(set)
    .where(
      and(
        eq(cardInstances.deletedAt, deletedAt),
        inArray(
          cardInstances.cardId,
          db
            .select({ id: cards.id })
            .from(cards)
            .where(and(inArray(cards.deckId, deckIds), eq(cards.deletedAt, deletedAt))),
        ),
      ),
    );
  await db
    .update(cards)
    .set(set)
    .where(and(inArray(cards.deckId, deckIds), eq(cards.deletedAt, deletedAt)));
}

/** Soft-deletes a deck and its cards. Returns the timestamp so `restoreDeck` can undo it. */
export async function deleteDeck(
  db: AppDatabase,
  id: string,
  { now = isoNow }: NowDep = {},
): Promise<string> {
  const deletedAt = now();
  await softDeleteDeckRows(db, [id], deletedAt);
  return deletedAt;
}

/** Undoes `deleteDeck` (with no `deletedAt`, the deck's latest delete). */
export async function restoreDeck(
  db: AppDatabase,
  id: string,
  deletedAt?: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const when = deletedAt ?? (await getDeck(db, id))?.deletedAt;
  if (!when) return;
  await restoreDeckRows(db, [id], when, now());
}

/** For the Library's folder delete: the decks in these folders, and their cards. */
export async function deleteDecksInFolders(
  db: AppDatabase,
  folderIds: string[],
  deletedAt: string,
): Promise<void> {
  if (folderIds.length === 0) return;
  const rows = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(inArray(decks.folderId, folderIds), isNull(decks.deletedAt)));
  await softDeleteDeckRows(
    db,
    rows.map((r) => r.id),
    deletedAt,
  );
}

/** Undoes `deleteDecksInFolders`. */
export async function restoreDecksInFolders(
  db: AppDatabase,
  folderIds: string[],
  deletedAt: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  if (folderIds.length === 0) return;
  const rows = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(inArray(decks.folderId, folderIds), eq(decks.deletedAt, deletedAt)));
  await restoreDeckRows(
    db,
    rows.map((r) => r.id),
    deletedAt,
    now(),
  );
}

// ---------------------------------------------------------------------------------------------
// Cards

/** The cards of a deck that haven't been deleted, oldest first. */
export async function listCards(db: AppDatabase, deckId: string): Promise<Card[]> {
  return db
    .select()
    .from(cards)
    .where(and(eq(cards.deckId, deckId), isNull(cards.deletedAt)))
    .orderBy(asc(cards.createdAt), asc(cards.id));
}

/** One card, including a deleted one. */
export async function getCard(db: AppDatabase, id: string): Promise<Card | undefined> {
  const rows = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  return rows[0];
}

/** A card's live instances, in key order. */
export async function listCardInstances(db: AppDatabase, cardId: string): Promise<CardInstance[]> {
  return db
    .select()
    .from(cardInstances)
    .where(and(eq(cardInstances.cardId, cardId), isNull(cardInstances.deletedAt)))
    .orderBy(asc(cardInstances.subKey));
}

/** Brings a card's instance rows in line with what the card now asks for. */
async function syncInstances(
  db: AppDatabase,
  card: Pick<Card, 'id' | 'ownerId'>,
  wanted: string[],
  timestamp: string,
  newId: () => string,
): Promise<void> {
  const existing = await db
    .select({
      id: cardInstances.id,
      subKey: cardInstances.subKey,
      deletedAt: cardInstances.deletedAt,
    })
    .from(cardInstances)
    .where(eq(cardInstances.cardId, card.id));
  const plan = planInstances(existing, wanted);
  if (plan.create.length > 0) {
    await db.insert(cardInstances).values(
      plan.create.map((subKey) => ({
        id: newId(),
        cardId: card.id,
        subKey,
        ownerId: card.ownerId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    );
  }
  if (plan.revive.length > 0) {
    await db
      .update(cardInstances)
      .set({ deletedAt: null, updatedAt: timestamp, dirty: true })
      .where(inArray(cardInstances.id, plan.revive));
  }
  if (plan.remove.length > 0) {
    await db
      .update(cardInstances)
      .set({ deletedAt: timestamp, updatedAt: timestamp, dirty: true })
      .where(inArray(cardInstances.id, plan.remove));
  }
}

function checkDraft(draft: CardDraft) {
  const problem = cardDraftProblem(draft);
  if (problem) throw new Error(`The card can’t be saved yet (${problem})`);
}

export type NewCardInput = { ownerId: string; deckId: string; draft: CardDraft };

/** Saves a new card and makes its reviewable instances (one per cloze number, direction…). */
export async function createCard(
  db: AppDatabase,
  input: NewCardInput,
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<Card> {
  checkDraft(input.draft);
  const draft = tidyDraft(input.draft);
  const timestamp = now();
  const card = db.transaction((tx) => {
    const [created] = tx
      .insert(cards)
      .values({
        id: newId(),
        ownerId: input.ownerId,
        deckId: input.deckId,
        type: draft.type,
        ...summariseDraft(draft),
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning()
      .all();
    const keys = instanceKeys(draft.type, draft.front.text);
    if (keys.length > 0) {
      tx.insert(cardInstances)
        .values(
          keys.map((subKey) => ({
            id: newId(),
            cardId: created.id,
            subKey,
            ownerId: input.ownerId,
            createdAt: timestamp,
            updatedAt: timestamp,
          })),
        )
        .run();
    }
    return created;
  });
  await touchDeck(db, input.deckId, timestamp);
  return card;
}

/**
 * Saves an edited card. Instances are matched by key: c1 keeps its row (and later its review
 * history) when its text changes; a removed cloze number's row is soft-deleted.
 */
export async function updateCard(
  db: AppDatabase,
  id: string,
  input: CardDraft,
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<void> {
  checkDraft(input);
  const card = await getCard(db, id);
  if (!card || card.deletedAt) throw new Error('That card is no longer here');
  const draft = tidyDraft(input);
  const timestamp = now();
  await db
    .update(cards)
    .set({ type: draft.type, ...summariseDraft(draft), updatedAt: timestamp, dirty: true })
    .where(eq(cards.id, id));
  await syncInstances(db, card, instanceKeys(draft.type, draft.front.text), timestamp, newId);
  await touchDeck(db, card.deckId, timestamp);
}

/** Soft-deletes a card and its instances. Returns the timestamp for `restoreCard`. */
export async function deleteCard(
  db: AppDatabase,
  id: string,
  { now = isoNow }: NowDep = {},
): Promise<string> {
  const deletedAt = now();
  const set = { deletedAt, updatedAt: deletedAt, dirty: true };
  await db
    .update(cards)
    .set(set)
    .where(and(eq(cards.id, id), isNull(cards.deletedAt)));
  await db
    .update(cardInstances)
    .set(set)
    .where(and(eq(cardInstances.cardId, id), isNull(cardInstances.deletedAt)));
  const card = await getCard(db, id);
  if (card) await touchDeck(db, card.deckId, deletedAt);
  return deletedAt;
}

/** Undoes `deleteCard`: the card and the instances deleted with it. */
export async function restoreCard(
  db: AppDatabase,
  id: string,
  deletedAt: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const timestamp = now();
  const set = { deletedAt: null, updatedAt: timestamp, dirty: true };
  await db
    .update(cards)
    .set(set)
    .where(and(eq(cards.id, id), eq(cards.deletedAt, deletedAt)));
  await db
    .update(cardInstances)
    .set(set)
    .where(and(eq(cardInstances.cardId, id), eq(cardInstances.deletedAt, deletedAt)));
  const card = await getCard(db, id);
  if (card) await touchDeck(db, card.deckId, timestamp);
}

/**
 * Adding, editing or deleting cards counts as changing the deck: it moves up in "Recently
 * changed", and live queries on `decks` (card counts in the Library) re-run.
 */
async function touchDeck(db: AppDatabase, deckId: string, timestamp: string) {
  await db.update(decks).set({ updatedAt: timestamp, dirty: true }).where(eq(decks.id, deckId));
}

export type DeckCounts = { cards: number; instances: number };

/** How many cards and reviewable instances each deck of an owner has (deck id → counts). */
export async function deckCounts(
  db: AppDatabase,
  ownerId: string,
): Promise<Map<string, DeckCounts>> {
  const rows = await db
    .select({
      deckId: cards.deckId,
      cards: sql<number>`count(distinct ${cards.id})`,
      instances: sql<number>`count(${cardInstances.id})`,
    })
    .from(cards)
    .leftJoin(
      cardInstances,
      and(eq(cardInstances.cardId, cards.id), isNull(cardInstances.deletedAt)),
    )
    .where(and(eq(cards.ownerId, ownerId), isNull(cards.deletedAt)))
    .groupBy(cards.deckId);
  return new Map(
    rows.map((r) => [r.deckId, { cards: Number(r.cards), instances: Number(r.instances) }]),
  );
}
