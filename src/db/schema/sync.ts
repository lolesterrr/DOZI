import { integer, text } from 'drizzle-orm/sqlite-core';

// ARCHITECTURE §3.1 — the columns every syncable user table has. Spread into a table definition:
// `sqliteTable('x', { id: text('id').primaryKey(), ...ownedColumns(), …, ...syncColumns() })`.

/** `owner_id` plus the created/updated/deleted timestamps (ISO-8601 UTC strings). */
export const ownedColumns = () => ({
  ownerId: text('owner_id').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  /** Set instead of deleting the row (soft delete), so the delete can sync and be undone. */
  deletedAt: text('deleted_at'),
});

/** Local-only sync bookkeeping. Never sent to the server. */
export const syncColumns = () => ({
  /** 1 when the row has changes the server hasn't seen yet. */
  dirty: integer('_dirty', { mode: 'boolean' }).notNull().default(true),
  syncedAt: text('_synced_at'),
});
