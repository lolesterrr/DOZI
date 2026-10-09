import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

import { noteVersions, notes, type Note, type NoteVersion } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId as defaultNewId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

import {
  cleanTitle,
  emptyDoc,
  isDocEmpty,
  parseNoteContent,
  shouldKeepVersion,
  summariseContent,
  versionsToPrune,
  type DocNode,
} from './logic';

type Deps = { newId?: () => string; now?: () => string };
type NowDep = Pick<Deps, 'now'>;

const isoNow = () => nowIso();

/** Every note of one owner that hasn't been deleted (the Library filters and sorts them). */
export async function listNotes(db: AppDatabase, ownerId: string): Promise<Note[]> {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.ownerId, ownerId), isNull(notes.deletedAt)));
}

/** One note, including a deleted one (so its screen can say it's gone). */
export async function getNote(db: AppDatabase, id: string): Promise<Note | undefined> {
  const rows = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  return rows[0];
}

export type NewNoteInput = {
  ownerId: string;
  /** null or missing = top level of the Notes segment. */
  folderId?: string | null;
  title?: string;
  content?: DocNode;
};

export async function createNote(
  db: AppDatabase,
  input: NewNoteInput,
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<Note> {
  const timestamp = now();
  const [created] = await db
    .insert(notes)
    .values({
      id: newId(),
      ownerId: input.ownerId,
      folderId: input.folderId ?? null,
      title: cleanTitle(input.title ?? ''),
      ...summariseContent(input.content ?? emptyDoc()),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();
  return created;
}

/**
 * Saves a new note body (autosave). Before replacing the old body it may keep it as a version
 * (see `shouldKeepVersion`), and it keeps only the newest versions. Unchanged content is skipped.
 * Returns false when there was nothing to save.
 */
export async function saveNoteContent(
  db: AppDatabase,
  id: string,
  doc: DocNode,
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<boolean> {
  const note = await getNote(db, id);
  if (!note || note.deletedAt) return false;
  const next = summariseContent(doc);
  if (next.contentJson === note.contentJson) return false;

  const timestamp = now();
  const [newestVersion] = await listNoteVersions(db, id);
  const keep = shouldKeepVersion({
    previousJson: note.contentJson,
    nextJson: next.contentJson,
    previousIsEmpty: isStoredContentEmpty(note.contentJson),
    newestVersion,
    nowMs: Date.parse(timestamp),
  });
  if (keep) await addVersion(db, id, note.contentJson, timestamp, newId);

  await db
    .update(notes)
    .set({ ...next, updatedAt: timestamp, dirty: true })
    .where(eq(notes.id, id));
  return true;
}

function isStoredContentEmpty(json: string): boolean {
  try {
    return isDocEmpty(parseNoteContent(json));
  } catch {
    return false;
  }
}

async function addVersion(
  db: AppDatabase,
  noteId: string,
  contentJson: string,
  createdAt: string,
  newId: () => string,
): Promise<void> {
  await db.insert(noteVersions).values({ id: newId(), noteId, contentJson, createdAt });
  const all = await db
    .select({ id: noteVersions.id, createdAt: noteVersions.createdAt })
    .from(noteVersions)
    .where(eq(noteVersions.noteId, noteId));
  const extra = versionsToPrune(all);
  if (extra.length > 0) await db.delete(noteVersions).where(inArray(noteVersions.id, extra));
}

export async function setNoteTitle(
  db: AppDatabase,
  id: string,
  title: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const cleaned = cleanTitle(title);
  const note = await getNote(db, id);
  if (!note || note.title === cleaned) return;
  await db
    .update(notes)
    .set({ title: cleaned, updatedAt: now(), dirty: true })
    .where(eq(notes.id, id));
}

export async function setNotePinned(
  db: AppDatabase,
  id: string,
  pinned: boolean,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  await db.update(notes).set({ pinned, updatedAt: now(), dirty: true }).where(eq(notes.id, id));
}

/** Moves a note into a Notes folder, or to the top level (null). */
export async function moveNote(
  db: AppDatabase,
  id: string,
  folderId: string | null,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  await db.update(notes).set({ folderId, updatedAt: now(), dirty: true }).where(eq(notes.id, id));
}

/** Soft-deletes a note. Returns the timestamp so `restoreNote` can undo exactly this delete. */
export async function deleteNote(
  db: AppDatabase,
  id: string,
  { now = isoNow }: NowDep = {},
): Promise<string> {
  const deletedAt = now();
  await db
    .update(notes)
    .set({ deletedAt, updatedAt: deletedAt, dirty: true })
    .where(and(eq(notes.id, id), isNull(notes.deletedAt)));
  return deletedAt;
}

export async function restoreNote(
  db: AppDatabase,
  id: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  await db
    .update(notes)
    .set({ deletedAt: null, updatedAt: now(), dirty: true })
    .where(eq(notes.id, id));
}

/** A note's earlier versions, newest first. */
export async function listNoteVersions(db: AppDatabase, noteId: string): Promise<NoteVersion[]> {
  return db
    .select()
    .from(noteVersions)
    .where(eq(noteVersions.noteId, noteId))
    .orderBy(desc(noteVersions.createdAt), desc(noteVersions.id));
}

/**
 * Puts an earlier version back as the note's body. The body it replaces is kept as a version
 * first (whatever its age), so a restore can itself be undone from history.
 * Returns the restored content.
 */
export async function restoreNoteVersion(
  db: AppDatabase,
  noteId: string,
  versionId: string,
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<DocNode> {
  const note = await getNote(db, noteId);
  const [version] = await db
    .select()
    .from(noteVersions)
    .where(and(eq(noteVersions.id, versionId), eq(noteVersions.noteId, noteId)))
    .limit(1);
  if (!note || note.deletedAt || !version) throw new Error('That version is no longer available');

  const doc = parseNoteContent(version.contentJson);
  const next = summariseContent(doc);
  const timestamp = now();
  if (next.contentJson !== note.contentJson && !isStoredContentEmpty(note.contentJson)) {
    await addVersion(db, noteId, note.contentJson, timestamp, newId);
  }
  await db
    .update(notes)
    .set({ ...next, updatedAt: timestamp, dirty: true })
    .where(eq(notes.id, noteId));
  return doc;
}

/**
 * Removes a note that was opened and left blank (no title, no content), so empty notes don't
 * pile up in the Library. Returns true if it was removed.
 */
export async function discardIfBlank(
  db: AppDatabase,
  id: string,
  deps: NowDep = {},
): Promise<boolean> {
  const note = await getNote(db, id);
  if (!note || note.deletedAt || note.title !== '') return false;
  if (!isStoredContentEmpty(note.contentJson)) return false;
  await deleteNote(db, id, deps);
  return true;
}
