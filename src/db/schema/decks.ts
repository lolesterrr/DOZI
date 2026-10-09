import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { ownedColumns, syncColumns } from './sync';

// ARCHITECTURE §3.3 — flashcard decks and cards (PRODUCT_SPEC §4.2).
// No foreign keys, like the other user tables: sync may bring a card before its deck.

export const deckSources = ['user', 'official', 'forked'] as const;
export type DeckSource = (typeof deckSources)[number];

export const deckVisibilities = ['private', 'link', 'public'] as const;
export type DeckVisibility = (typeof deckVisibilities)[number];

/** A deck of flashcards, kept in the Library's Decks segment. */
export const decks = sqliteTable(
  'decks',
  {
    id: text('id').primaryKey(),
    ...ownedColumns(),
    folderId: text('folder_id'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    /** Optional link to a curriculum topic (Phase 2). */
    topicId: text('topic_id'),
    source: text('source', { enum: deckSources }).notNull().default('user'),
    forkedFrom: text('forked_from'),
    officialDeckId: text('official_deck_id'),
    visibility: text('visibility', { enum: deckVisibilities }).notNull().default('private'),
    shareCode: text('share_code'),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    newPerDay: integer('new_per_day').notNull().default(15),
    maxReviewsPerDay: integer('max_reviews_per_day').notNull().default(200),
    desiredRetention: real('desired_retention').notNull().default(0.9),
    ...syncColumns(),
  },
  (t) => [index('decks_owner_idx').on(t.ownerId), index('decks_folder_idx').on(t.folderId)],
);

export type Deck = typeof decks.$inferSelect;
export type NewDeck = typeof decks.$inferInsert;

export const cardTypes = ['basic', 'basic_reverse', 'cloze', 'type_in', 'image_occlusion'] as const;
export type CardType = (typeof cardTypes)[number];

/**
 * One card as the student wrote it. Faces are ProseMirror JSON (images as `media://<id>`), with
 * plain-text copies for previews and search. A card can give several reviewable instances.
 */
export const cards = sqliteTable(
  'cards',
  {
    id: text('id').primaryKey(),
    ...ownedColumns(),
    deckId: text('deck_id').notNull(),
    type: text('type', { enum: cardTypes }).notNull(),
    frontJson: text('front_json').notNull(),
    backJson: text('back_json').notNull(),
    /** Shown after the answer: a mnemonic or an explanation. Null when empty. */
    extraJson: text('extra_json'),
    frontText: text('front_text').notNull().default(''),
    backText: text('back_text').notNull().default(''),
    /** Image occlusion (task 1.9): `{ media_id, mode, masks: [...] }`. */
    occlusionJson: text('occlusion_json'),
    topicId: text('topic_id'),
    drugId: text('drug_id'),
    /** The note a card was made from ("Make card", later). */
    sourceNoteId: text('source_note_id'),
    suspended: integer('suspended', { mode: 'boolean' }).notNull().default(false),
    ...syncColumns(),
  },
  (t) => [index('cards_owner_idx').on(t.ownerId), index('cards_deck_idx').on(t.deckId)],
);

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;

/**
 * Derived from `cards`: one row per thing to review (a basic card, each direction of a reverse
 * card, each cloze number, each occlusion mask). `sub_key` says which ("front", "reverse", "c2"…).
 * Rows are kept when a card is edited, so their review history (task 1.7) stays attached.
 * (card_id, sub_key) is not a unique index: two phones editing the same card offline could each
 * add the same cloze number, and sync must not fail on that — the repo copes with duplicates.
 */
export const cardInstances = sqliteTable(
  'card_instances',
  {
    id: text('id').primaryKey(),
    cardId: text('card_id').notNull(),
    subKey: text('sub_key').notNull(),
    ...ownedColumns(),
    ...syncColumns(),
  },
  (t) => [index('card_instances_card_sub_idx').on(t.cardId, t.subKey)],
);

export type CardInstance = typeof cardInstances.$inferSelect;
export type NewCardInstance = typeof cardInstances.$inferInsert;
