import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { cardInstances, cards, decks, type Card, type CardInstance, type Deck } from '@/db/schema';
import { inSlices } from '@/db/slices';
import type { AppDatabase } from '@/db/types';
import { newId as defaultNewId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

import {
  addCardTags,
  cardDraftProblem,
  cardTagsJson,
  cleanCardTags,
  cleanDeckTitle,
  deckTitleProblem,
  DECK_DESCRIPTION_MAX,
  cardMatchKey,
  draftInstanceKeys,
  parseCardTags,
  planCardImport,
  planInstances,
  removeCardTag,
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

/** Soft-deletes many decks (and their cards) at once, with one timestamp for undo. */
export async function deleteDecks(
  db: AppDatabase,
  ids: readonly string[],
  { now = isoNow }: NowDep = {},
): Promise<string> {
  const deletedAt = now();
  for (const slice of inSlices(ids)) await softDeleteDeckRows(db, slice, deletedAt);
  return deletedAt;
}

/** Undoes `deleteDecks`. */
export async function restoreDecks(
  db: AppDatabase,
  ids: readonly string[],
  deletedAt: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const timestamp = now();
  for (const slice of inSlices(ids)) await restoreDeckRows(db, slice, deletedAt, timestamp);
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

export type NewCardInput = {
  ownerId: string;
  deckId: string;
  draft: CardDraft;
  /** The note the card was made from ("Make card" in a note), shown as a link on the card. */
  sourceNoteId?: string | null;
  /** The card's own tags. */
  tags?: readonly string[];
};

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
        tagsJson: cardTagsJson(input.tags ?? []),
        sourceNoteId: input.sourceNoteId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning()
      .all();
    const keys = draftInstanceKeys(draft);
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
  { newId = defaultNewId, now = isoNow, tags }: Deps & { tags?: readonly string[] } = {},
): Promise<void> {
  checkDraft(input);
  const card = await getCard(db, id);
  if (!card || card.deletedAt) throw new Error('That card is no longer here');
  const draft = tidyDraft(input);
  const timestamp = now();
  await db
    .update(cards)
    .set({
      type: draft.type,
      ...summariseDraft(draft),
      // Left as they are when no tags are given.
      ...(tags ? { tagsJson: cardTagsJson(tags) } : {}),
      updatedAt: timestamp,
      dirty: true,
    })
    .where(eq(cards.id, id));
  await syncInstances(db, card, draftInstanceKeys(draft), timestamp, newId);
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

/** Soft-deletes many cards (and their instances) at once, with one timestamp for undo. */
export async function deleteCards(
  db: AppDatabase,
  ids: readonly string[],
  { now = isoNow }: NowDep = {},
): Promise<string> {
  const deletedAt = now();
  const set = { deletedAt, updatedAt: deletedAt, dirty: true };
  for (const slice of inSlices(ids)) {
    await db
      .update(cards)
      .set(set)
      .where(and(inArray(cards.id, slice), isNull(cards.deletedAt)));
    await db
      .update(cardInstances)
      .set(set)
      .where(and(inArray(cardInstances.cardId, slice), isNull(cardInstances.deletedAt)));
  }
  await touchDecksOfCards(db, ids, deletedAt);
  return deletedAt;
}

/** Undoes `deleteCards`. */
export async function restoreCards(
  db: AppDatabase,
  ids: readonly string[],
  deletedAt: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const timestamp = now();
  const set = { deletedAt: null, updatedAt: timestamp, dirty: true };
  for (const slice of inSlices(ids)) {
    await db
      .update(cards)
      .set(set)
      .where(and(inArray(cards.id, slice), eq(cards.deletedAt, deletedAt)));
    await db
      .update(cardInstances)
      .set(set)
      .where(and(inArray(cardInstances.cardId, slice), eq(cardInstances.deletedAt, deletedAt)));
  }
  await touchDecksOfCards(db, ids, timestamp);
}

/** Marks the decks holding these cards as changed (so counts and "Recently changed" update). */
async function touchDecksOfCards(db: AppDatabase, cardIds: readonly string[], timestamp: string) {
  const deckIds = new Set<string>();
  for (const slice of inSlices(cardIds)) {
    const rows = await db
      .select({ deckId: cards.deckId })
      .from(cards)
      .where(inArray(cards.id, slice));
    for (const row of rows) deckIds.add(row.deckId);
  }
  for (const slice of inSlices([...deckIds])) {
    await db
      .update(decks)
      .set({ updatedAt: timestamp, dirty: true })
      .where(inArray(decks.id, slice));
  }
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
 * Suspends a card (all its instances leave reviews until it is unsuspended) or brings it back.
 * Its review history and schedule are kept.
 */
export async function setCardSuspended(
  db: AppDatabase,
  id: string,
  suspended: boolean,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const timestamp = now();
  await db
    .update(cards)
    .set({ suspended, updatedAt: timestamp, dirty: true })
    .where(eq(cards.id, id));
  const card = await getCard(db, id);
  if (card) await touchDeck(db, card.deckId, timestamp);
}

export type CardTagChange = { cardId: string; tagsJson: string };

/**
 * Adds one tag to many cards (or takes it off them). Only cards whose tags change are written.
 * Returns each changed card's tags from before, so `restoreCardTags` can undo it.
 */
export async function changeCardsTag(
  db: AppDatabase,
  ids: readonly string[],
  tag: string,
  action: 'add' | 'remove',
  { now = isoNow }: NowDep = {},
): Promise<CardTagChange[]> {
  const [cleaned] = cleanCardTags([tag]);
  if (!cleaned) return [];
  const timestamp = now();
  const before: CardTagChange[] = [];
  for (const slice of inSlices(ids)) {
    const rows = await db
      .select({ id: cards.id, tagsJson: cards.tagsJson })
      .from(cards)
      .where(and(inArray(cards.id, slice), isNull(cards.deletedAt)));
    for (const row of rows) {
      const current = parseCardTags(row.tagsJson);
      const next =
        action === 'add' ? addCardTags(current, [cleaned]) : removeCardTag(current, cleaned);
      const json = cardTagsJson(next);
      if (json === cardTagsJson(current)) continue;
      before.push({ cardId: row.id, tagsJson: row.tagsJson });
      await db
        .update(cards)
        .set({ tagsJson: json, updatedAt: timestamp, dirty: true })
        .where(eq(cards.id, row.id));
    }
  }
  await touchDecksOfCards(
    db,
    before.map((c) => c.cardId),
    timestamp,
  );
  return before;
}

/** Puts cards' tags back as they were (undo for `changeCardsTag` and for an import). */
export async function restoreCardTags(
  db: AppDatabase,
  changes: readonly CardTagChange[],
  { now = isoNow }: NowDep = {},
): Promise<void> {
  if (changes.length === 0) return;
  const timestamp = now();
  for (const change of changes) {
    await db
      .update(cards)
      .set({ tagsJson: change.tagsJson, updatedAt: timestamp, dirty: true })
      .where(eq(cards.id, change.cardId));
  }
  await touchDecksOfCards(
    db,
    changes.map((c) => c.cardId),
    timestamp,
  );
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

// ---------------------------------------------------------------------------------------------
// Import (CSV, task 1.12)

export type ImportedCards = {
  /** The new cards. */
  cardIds: string[];
  /** Cards already in the deck whose tags the import changed, with their tags from before. */
  retagged: CardTagChange[];
  importedAt: string;
};

/** The match keys of a deck's live cards, for `planCardImport`. */
export async function deckCardKeys(
  db: AppDatabase,
  deckId: string,
): Promise<{ id: string; key: string }[]> {
  const rows = await db
    .select({
      id: cards.id,
      type: cards.type,
      frontJson: cards.frontJson,
      backJson: cards.backJson,
    })
    .from(cards)
    .where(and(eq(cards.deckId, deckId), isNull(cards.deletedAt)))
    .orderBy(asc(cards.createdAt), asc(cards.id));
  return rows.map((row) => ({ id: row.id, key: cardMatchKey(row) }));
}

/**
 * Saves many cards into a deck in one transaction (fast enough for a few thousand on a cheap
 * phone). Each card is 1 ms newer than the one before, so the deck lists them in file order.
 * `tags[i]` are the tags of `drafts[i]`. Rows matching a card already in the deck only add
 * their tags to it (see `planCardImport`). Drafts that can't be saved are left out;
 * `planCsvImport` already skips those.
 */
export async function importCards(
  db: AppDatabase,
  input: {
    ownerId: string;
    deckId: string;
    drafts: readonly CardDraft[];
    tags?: readonly (readonly string[])[];
  },
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<ImportedCards> {
  const importedAt = now();
  const base = Date.parse(importedAt);
  const existing = await deckCardKeys(db, input.deckId);
  const plan = planCardImport(input.drafts, input.tags ?? [], existing);
  const cardIds: string[] = [];
  const retagged: CardTagChange[] = [];
  db.transaction((tx) => {
    plan.steps.forEach((step, index) => {
      const timestamp = Number.isFinite(base) ? new Date(base + index).toISOString() : importedAt;
      if (step.kind === 'tag') {
        if (step.tags.length === 0) return;
        const row = tx
          .select({ tagsJson: cards.tagsJson })
          .from(cards)
          .where(eq(cards.id, step.cardId))
          .all()[0];
        if (!row) return;
        const json = cardTagsJson(addCardTags(parseCardTags(row.tagsJson), step.tags));
        if (json === cardTagsJson(parseCardTags(row.tagsJson))) return;
        retagged.push({ cardId: step.cardId, tagsJson: row.tagsJson });
        tx.update(cards)
          .set({ tagsJson: json, updatedAt: importedAt, dirty: true })
          .where(eq(cards.id, step.cardId))
          .run();
        return;
      }
      const draft = tidyDraft(input.drafts[step.draftIndex]);
      const id = newId();
      tx.insert(cards)
        .values({
          id,
          ownerId: input.ownerId,
          deckId: input.deckId,
          type: draft.type,
          ...summariseDraft(draft),
          tagsJson: cardTagsJson(step.tags),
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
      const keys = draftInstanceKeys(draft);
      if (keys.length > 0) {
        tx.insert(cardInstances)
          .values(
            keys.map((subKey) => ({
              id: newId(),
              cardId: id,
              subKey,
              ownerId: input.ownerId,
              createdAt: timestamp,
              updatedAt: timestamp,
            })),
          )
          .run();
      }
      cardIds.push(id);
    });
  });
  if (cardIds.length > 0 || retagged.length > 0) await touchDeck(db, input.deckId, importedAt);
  return { cardIds, retagged, importedAt };
}

/** Undo for `importCards`: soft-deletes the new cards and puts changed tags back. */
export async function undoImport(
  db: AppDatabase,
  deckId: string,
  cardIds: readonly string[],
  { now = isoNow, retagged = [] }: NowDep & { retagged?: readonly CardTagChange[] } = {},
): Promise<void> {
  if (retagged.length > 0) await restoreCardTags(db, retagged, { now });
  if (cardIds.length === 0) return;
  const timestamp = now();
  const set = { deletedAt: timestamp, updatedAt: timestamp, dirty: true };
  // SQLite limits how many values one statement can bind, so go in chunks.
  for (let i = 0; i < cardIds.length; i += 500) {
    const chunk = cardIds.slice(i, i + 500);
    await db
      .update(cardInstances)
      .set(set)
      .where(and(inArray(cardInstances.cardId, chunk), isNull(cardInstances.deletedAt)));
    await db
      .update(cards)
      .set(set)
      .where(and(inArray(cards.id, chunk), isNull(cards.deletedAt)));
  }
  await touchDeck(db, deckId, timestamp);
}
