import { and, asc, eq, isNull } from 'drizzle-orm';

import { timetableClasses, timetables, type Timetable, type TimetableClass } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { getSetting, setSetting } from '@/features/settings/repo';
import { newId as defaultNewId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

import { classDraftProblem, tidyDraft, type ClassDraft } from './logic';

// Timetables and their classes (ARCHITECTURE §3.9). Every change marks rows dirty for sync.
// Which timetable is in use is a local setting, so each phone can show its own.

type Deps = { newId?: () => string; now?: () => string };
const isoNow = () => nowIso();

export const ACTIVE_TIMETABLE_KEY = 'timetable_active';
export const NAME_MAX = 60;

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
}

/** Every live timetable of an owner, oldest first. */
export function timetableListQuery(db: AppDatabase, ownerId: string) {
  return db
    .select()
    .from(timetables)
    .where(and(eq(timetables.ownerId, ownerId), isNull(timetables.deletedAt)))
    .orderBy(asc(timetables.createdAt), asc(timetables.id));
}

/** Every live class of one timetable. */
export function classListQuery(db: AppDatabase, timetableId: string) {
  return db
    .select()
    .from(timetableClasses)
    .where(and(eq(timetableClasses.timetableId, timetableId), isNull(timetableClasses.deletedAt)))
    .orderBy(asc(timetableClasses.weekday), asc(timetableClasses.startTime));
}

export async function listTimetables(db: AppDatabase, ownerId: string): Promise<Timetable[]> {
  return timetableListQuery(db, ownerId);
}

export async function listClasses(db: AppDatabase, timetableId: string): Promise<TimetableClass[]> {
  return classListQuery(db, timetableId);
}

export async function getClass(db: AppDatabase, id: string): Promise<TimetableClass | undefined> {
  const rows = await db.select().from(timetableClasses).where(eq(timetableClasses.id, id)).limit(1);
  return rows[0];
}

export async function createTimetable(
  db: AppDatabase,
  input: { ownerId: string; name: string },
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<Timetable> {
  const name = cleanName(input.name);
  if (!name) throw new Error('A timetable needs a name');
  const timestamp = now();
  const [created] = await db
    .insert(timetables)
    .values({
      id: newId(),
      ownerId: input.ownerId,
      name,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();
  return created;
}

export async function renameTimetable(
  db: AppDatabase,
  id: string,
  name: string,
  { now = isoNow }: Deps = {},
): Promise<void> {
  const clean = cleanName(name);
  if (!clean) throw new Error('A timetable needs a name');
  await db
    .update(timetables)
    .set({ name: clean, updatedAt: now(), dirty: true })
    .where(eq(timetables.id, id));
}

/** Soft-deletes a timetable and its classes. */
export async function deleteTimetable(
  db: AppDatabase,
  id: string,
  { now = isoNow }: Deps = {},
): Promise<void> {
  const at = now();
  await db
    .update(timetables)
    .set({ deletedAt: at, updatedAt: at, dirty: true })
    .where(eq(timetables.id, id));
  await db
    .update(timetableClasses)
    .set({ deletedAt: at, updatedAt: at, dirty: true })
    .where(and(eq(timetableClasses.timetableId, id), isNull(timetableClasses.deletedAt)));
}

/** The saved active timetable id, if any (it may point at a deleted one; see `pickActive`). */
export async function getActiveTimetableId(db: AppDatabase): Promise<string | null> {
  const value = await getSetting(db, ACTIVE_TIMETABLE_KEY);
  return typeof value === 'string' ? value : null;
}

export async function setActiveTimetableId(db: AppDatabase, id: string): Promise<void> {
  await setSetting(db, ACTIVE_TIMETABLE_KEY, id);
}

/** The timetable in use: the saved one if it still exists, otherwise the oldest. */
export function pickActive<T extends { id: string }>(list: readonly T[], savedId: string | null) {
  return list.find((t) => t.id === savedId) ?? list[0];
}

/**
 * The timetable to add a class to: the active one, or a first one (named `defaultName`) made on
 * the spot and set active.
 */
export async function ensureActiveTimetable(
  db: AppDatabase,
  ownerId: string,
  defaultName: string,
  deps: Deps = {},
): Promise<Timetable> {
  const list = await listTimetables(db, ownerId);
  const active = pickActive(list, await getActiveTimetableId(db));
  if (active) return active;
  const created = await createTimetable(db, { ownerId, name: defaultName }, deps);
  await setActiveTimetableId(db, created.id);
  return created;
}

function rowValues(draft: ClassDraft) {
  return {
    title: draft.title,
    code: draft.code,
    kind: draft.kind,
    startTime: draft.startTime,
    endTime: draft.endTime,
    location: draft.location,
    lecturer: draft.lecturer,
    colour: draft.colour,
    remindersJson: JSON.stringify(draft.reminders),
  };
}

/** Adds a class on each chosen day (one row per day). Returns the new rows. */
export async function createClasses(
  db: AppDatabase,
  input: { ownerId: string; timetableId: string; draft: ClassDraft },
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<TimetableClass[]> {
  const draft = tidyDraft(input.draft);
  const problem = classDraftProblem(draft);
  if (problem) throw new Error(`The class can’t be saved: ${problem}`);
  const timestamp = now();
  return db
    .insert(timetableClasses)
    .values(
      draft.weekdays.map((weekday) => ({
        id: newId(),
        ownerId: input.ownerId,
        timetableId: input.timetableId,
        weekday,
        ...rowValues(draft),
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    )
    .returning();
}

/** Saves changes to one class (its first chosen day becomes its day). */
export async function updateClass(
  db: AppDatabase,
  id: string,
  draft: ClassDraft,
  { now = isoNow }: Deps = {},
): Promise<void> {
  const clean = tidyDraft(draft);
  const problem = classDraftProblem(clean);
  if (problem) throw new Error(`The class can’t be saved: ${problem}`);
  await db
    .update(timetableClasses)
    .set({ ...rowValues(clean), weekday: clean.weekdays[0], updatedAt: now(), dirty: true })
    .where(eq(timetableClasses.id, id));
}

export async function deleteClass(db: AppDatabase, id: string, { now = isoNow }: Deps = {}) {
  const at = now();
  await db
    .update(timetableClasses)
    .set({ deletedAt: at, updatedAt: at, dirty: true })
    .where(eq(timetableClasses.id, id));
}

export async function restoreClass(db: AppDatabase, id: string, { now = isoNow }: Deps = {}) {
  await db
    .update(timetableClasses)
    .set({ deletedAt: null, updatedAt: now(), dirty: true })
    .where(eq(timetableClasses.id, id));
}
