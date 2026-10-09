import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { ownedColumns, syncColumns } from './sync';

// ARCHITECTURE §3.3 — how the student organises their own notes, decks and quizzes.
// No foreign keys between these tables: sync (Phase 3) may bring a child row before its parent.

/** The kinds of item the Library holds. Each kind has its own folder tree. */
export const libraryItemTypes = ['note', 'deck', 'quiz'] as const;
export type LibraryItemType = (typeof libraryItemTypes)[number];

/** A folder in one segment of the Library. `parent_id` null = top level. Folders can nest. */
export const folders = sqliteTable(
  'folders',
  {
    id: text('id').primaryKey(),
    ...ownedColumns(),
    parentId: text('parent_id'),
    name: text('name').notNull(),
    kind: text('kind', { enum: libraryItemTypes }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...syncColumns(),
  },
  (t) => [
    index('folders_owner_kind_idx').on(t.ownerId, t.kind),
    index('folders_parent_idx').on(t.parentId),
  ],
);

export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;

/** Colour names for tags. They map to theme tokens (`features/library/logic.ts`), never hex. */
export const tagColours = ['teal', 'gold', 'green', 'red', 'amber', 'grey'] as const;
export type TagColour = (typeof tagColours)[number];

/** A label the student can put on any note, deck or quiz. Names are unique per owner. */
export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    ...ownedColumns(),
    name: text('name').notNull(),
    colour: text('colour', { enum: tagColours }).notNull().default('teal'),
    ...syncColumns(),
  },
  (t) => [index('tags_owner_idx').on(t.ownerId)],
);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

/**
 * Which tags are on which item. Removing a tag soft-deletes the link (so the removal syncs);
 * adding it back revives the same row.
 */
export const itemTags = sqliteTable(
  'item_tags',
  {
    itemType: text('item_type', { enum: libraryItemTypes }).notNull(),
    itemId: text('item_id').notNull(),
    tagId: text('tag_id').notNull(),
    ...ownedColumns(),
    ...syncColumns(),
  },
  (t) => [
    primaryKey({ columns: [t.itemType, t.itemId, t.tagId] }),
    index('item_tags_tag_idx').on(t.tagId),
  ],
);

export type ItemTag = typeof itemTags.$inferSelect;
