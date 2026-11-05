import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig, type SQLiteColumn, type SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  achievements,
  cardInstances,
  cards,
  cardState,
  decks,
  folders,
  itemTags,
  media,
  notes,
  questionResponses,
  questions,
  quizAttempts,
  quizQuestions,
  quizzes,
  reviewLogs,
  streakState,
  tags,
  timetableClasses,
  timetables,
  xpEvents,
} from '@/db/schema';

import { columnKind, LOCAL_ONLY_COLUMNS, type SyncTableSpec } from './logic';

/** A synced table: its Drizzle table plus the column mapping (built from the Drizzle schema). */
export type SyncTable = SyncTableSpec & {
  table: SQLiteTable;
  /** Drizzle columns by remote name, for building queries. */
  byRemote: Record<string, SQLiteColumn>;
  /** The local-only `_dirty` column. */
  dirty: SQLiteColumn;
};

function describeTable(table: SQLiteTable): SyncTable {
  const columns = getTableColumns(table) as Record<string, SQLiteColumn>;
  const config = getTableConfig(table);
  const composite = config.primaryKeys[0]?.columns.map((c) => c.name);
  const single = Object.values(columns)
    .filter((c) => c.primary)
    .map((c) => c.name);
  const byRemote: Record<string, SQLiteColumn> = {};
  const synced = Object.entries(columns)
    .filter(([, c]) => !LOCAL_ONLY_COLUMNS.has(c.name))
    .map(([prop, c]) => {
      byRemote[c.name] = c;
      return { prop, remote: c.name, kind: columnKind(c.name, c.columnType) };
    });
  return {
    name: getTableName(table),
    key: composite && composite.length > 0 ? composite : single,
    columns: synced,
    table,
    byRemote,
    dirty: columns.dirty,
  };
}

/**
 * Every synced table in push order (ARCHITECTURE §4). The server has no foreign keys, so the order
 * only keeps uploads tidy; pulls use the same order.
 */
export const SYNC_TABLES: readonly SyncTable[] = [
  folders,
  tags,
  media,
  notes,
  itemTags,
  decks,
  cards,
  cardInstances,
  questions,
  quizzes,
  quizQuestions,
  quizAttempts,
  questionResponses,
  reviewLogs,
  cardState,
  xpEvents,
  streakState,
  achievements,
  timetables,
  timetableClasses,
].map((t) => describeTable(t as unknown as SQLiteTable));
