import { and, desc, eq, inArray, isNull, like, sql } from 'drizzle-orm';

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
  toFtsQuery,
  versionsToPrune,
  type DocNode,
  MATCH_END,
  MATCH_START,
} from './logic';
import { sampleNotes } from './sampleNotes';
import { isUntouchedTemplate, templateDoc, type NoteTemplate } from './templates';

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
  /** Starts the note from a template's headings; ignored when `content` is given. */
  template?: NoteTemplate | null;
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
      template: input.template ?? null,
      ...summariseContent(
        input.content ?? (input.template ? templateDoc(input.template) : emptyDoc()),
      ),
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

function isStoredTemplate(note: Note): boolean {
  try {
    return isUntouchedTemplate(parseNoteContent(note.contentJson), note.template);
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
 * Removes a note that was opened and left blank (no title, and no content or only its untouched
 * template), so empty notes don't pile up in the Library. Returns true if it was removed.
 */
export async function discardIfBlank(
  db: AppDatabase,
  id: string,
  deps: NowDep = {},
): Promise<boolean> {
  const note = await getNote(db, id);
  if (!note || note.deletedAt || note.title !== '') return false;
  if (!isStoredContentEmpty(note.contentJson) && !isStoredTemplate(note)) return false;
  await deleteNote(db, id, deps);
  return true;
}

// ---------------------------------------------------------------------------------------------
// Search (notes_fts, kept up to date by triggers in migration 0004)

export type NoteSearchResult = {
  id: string;
  /** The title with matches between MATCH_START and MATCH_END (see `splitHighlights`). */
  title: string;
  /** A few words of text around the first match, marked the same way ('' if only the title matched). */
  snippet: string;
  pinned: boolean;
  updatedAt: string;
};

/** How many results a search returns at most. */
export const NOTE_SEARCH_LIMIT = 50;

/**
 * Notes of one owner whose title or text contains every word typed (each word also matches the
 * start of longer words). Best matches first; a match in the title counts more than one in the text.
 */
export async function searchNotes(
  db: AppDatabase,
  ownerId: string,
  input: string,
  limit: number = NOTE_SEARCH_LIMIT,
): Promise<NoteSearchResult[]> {
  const query = toFtsQuery(input);
  if (!query) return [];
  const rows = await db.all<{
    id: string;
    title: string;
    snippet: string;
    pinned: number;
    updated_at: string;
  }>(sql`
    SELECT n.id, highlight(notes_fts, 1, ${MATCH_START}, ${MATCH_END}) AS title,
      snippet(notes_fts, 2, ${MATCH_START}, ${MATCH_END}, '…', 16) AS snippet,
      n.pinned, n.updated_at
    FROM notes_fts
    JOIN ${notes} n ON n.id = notes_fts.note_id
    WHERE notes_fts MATCH ${query} AND n.owner_id = ${ownerId} AND n.deleted_at IS NULL
    ORDER BY bm25(notes_fts, 0, 4, 1), n.updated_at DESC
    LIMIT ${limit}
  `);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    snippet: row.snippet.includes(MATCH_START) ? row.snippet : '',
    pinned: Boolean(row.pinned),
    updatedAt: row.updated_at,
  }));
}

// ---------------------------------------------------------------------------------------------
// SAMPLE notes for testing search speed (dev screen only)

/** Adds `count` notes titled "SAMPLE …" (made-up study text, no drug facts) in one transaction. */
export async function addSampleNotes(
  db: AppDatabase,
  ownerId: string,
  count: number,
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<void> {
  const timestamp = now();
  const rows = sampleNotes(count).map((sample) => ({
    id: newId(),
    ownerId,
    title: sample.title,
    ...summariseContent(sample.doc),
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  db.transaction((tx) => {
    for (let i = 0; i < rows.length; i += 100)
      tx.insert(notes)
        .values(rows.slice(i, i + 100))
        .run();
  });
}

/** Removes every SAMPLE note for good (they were only for testing). Returns how many. */
export async function removeSampleNotes(db: AppDatabase, ownerId: string): Promise<number> {
  const removed = await db
    .delete(notes)
    .where(and(eq(notes.ownerId, ownerId), like(notes.title, 'SAMPLE %')))
    .returning({ id: notes.id });
  return removed.length;
}
