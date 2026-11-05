import { and, count, eq, type SQL } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

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
  profiles,
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
import type { AppDatabase } from '@/db/types';
import { nowIso } from '@/lib/time';

import { adoptionDecision, type AdoptionDecision } from './logic';
import { getProfile } from '@/features/profile/repo';

type OwnedTable = SQLiteTable & { ownerId: SQLiteColumn; dirty: SQLiteColumn };

/** Every local table that syncs (ARCHITECTURE §4), i.e. every table with owner_id and _dirty. */
const SYNCED_TABLES: readonly OwnedTable[] = [
  folders,
  tags,
  itemTags,
  media,
  notes,
  decks,
  cards,
  cardInstances,
  cardState,
  reviewLogs,
  questions,
  quizzes,
  quizQuestions,
  quizAttempts,
  questionResponses,
  xpEvents,
  streakState,
  achievements,
  timetables,
  timetableClasses,
] as unknown as readonly OwnedTable[];

export type AdoptionResult = { decision: AdoptionDecision; rowsAdopted: number };

/**
 * First sign-in on this phone (ARCHITECTURE §3.2): everything the student made before signing in
 * becomes theirs. In one transaction, every row's owner_id and the profile's id change from the
 * device's random id to the auth user id, and every row is marked dirty so sync (3.3) uploads it.
 * Nothing is deleted. `updated_at` is left alone: a new owner isn't an edit.
 *
 * Returns 'other-account' (and changes nothing) when this phone's study already belongs to a
 * different account.
 */
export async function adoptLocalData(
  db: AppDatabase,
  authUserId: string,
  { now = nowIso }: { now?: () => string } = {},
): Promise<AdoptionResult> {
  const profile = await getProfile(db);
  if (!profile) return { decision: 'adopt', rowsAdopted: 0 };
  const decision = adoptionDecision(profile, authUserId);
  if (decision !== 'adopt') return { decision, rowsAdopted: 0 };

  const oldId = profile.id;
  let rowsAdopted = 0;
  db.transaction((tx) => {
    for (const table of SYNCED_TABLES) {
      const result = tx
        .update(table)
        .set({ ownerId: authUserId, dirty: true } as never)
        .where(eq(table.ownerId, oldId))
        .run() as { changes?: number };
      rowsAdopted += result.changes ?? 0;
    }
    tx.update(profiles)
      .set({ id: authUserId, authUserId, updatedAt: now() })
      .where(eq(profiles.id, oldId))
      .run();
  });
  return { decision, rowsAdopted };
}

/**
 * How many of the student's rows have changes the server hasn't seen. Until sync (3.3) exists
 * this is everything they've made; the sign-out warning uses it.
 */
export async function countUnsyncedChanges(db: AppDatabase, ownerId: string): Promise<number> {
  let total = 0;
  for (const table of SYNCED_TABLES) {
    const where: SQL | undefined = and(eq(table.ownerId, ownerId), eq(table.dirty, true));
    const [row] = await db.select({ n: count() }).from(table).where(where);
    total += row?.n ?? 0;
  }
  return total;
}
