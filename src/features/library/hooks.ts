import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { folders, itemTags, notes, tags, type LibraryItemType, type TagColour } from '@/db/schema';
import * as notesRepo from '@/features/notes/repo';
import { notePreview } from '@/features/notes/logic';
import { useProfile } from '@/features/profile/hooks';
import { getSetting, setSetting } from '@/features/settings';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

import {
  DEFAULT_LIBRARY_SORT,
  groupTagIds,
  isLibrarySort,
  type LibraryItem,
  type LibrarySort,
} from './logic';
import * as repo from './repo';

const log = createLogger('library');

const SORT_SETTING = 'library.sort';

/** The profile id: every Library row belongs to it. Empty while the profile loads. */
export function useOwnerId(): string {
  return useProfile().profile?.id ?? '';
}

/** Every folder of one kind, kept up to date. */
export function useFolders(kind: LibraryItemType) {
  const db = useDatabase();
  const ownerId = useOwnerId();
  const { data } = useLiveQuery(
    db
      .select()
      .from(folders)
      .where(and(eq(folders.ownerId, ownerId), eq(folders.kind, kind), isNull(folders.deletedAt)))
      .orderBy(asc(folders.name)),
    [ownerId, kind],
  );
  return data;
}

/** One folder (including a deleted one, so the screen can say it's gone). */
export function useFolder(id: string) {
  const db = useDatabase();
  const { data, updatedAt } = useLiveQuery(
    db.select().from(folders).where(eq(folders.id, id)).limit(1),
    [id],
  );
  return { folder: data[0], loading: updatedAt === undefined };
}

/** Every tag, A–Z, kept up to date. */
export function useTags() {
  const db = useDatabase();
  const ownerId = useOwnerId();
  const { data } = useLiveQuery(
    db
      .select()
      .from(tags)
      .where(and(eq(tags.ownerId, ownerId), isNull(tags.deletedAt)))
      .orderBy(asc(tags.name)),
    [ownerId],
  );
  return data;
}

/** item id → tag ids, for one kind of item. */
export function useItemTagMap(kind: LibraryItemType): Map<string, string[]> {
  const db = useDatabase();
  const ownerId = useOwnerId();
  const { data } = useLiveQuery(
    db
      .select({ itemId: itemTags.itemId, tagId: itemTags.tagId })
      .from(itemTags)
      .innerJoin(tags, eq(tags.id, itemTags.tagId))
      .where(
        and(
          eq(itemTags.ownerId, ownerId),
          eq(itemTags.itemType, kind),
          isNull(itemTags.deletedAt),
          isNull(tags.deletedAt),
        ),
      ),
    [ownerId, kind],
  );
  return useMemo(() => groupTagIds(data), [data]);
}

/**
 * Every note, deck or quiz of one kind, with its tags. Notes arrived in task 1.3; decks (1.6) and
 * quizzes (1.10) each add a live query here that maps their rows to `LibraryItem`.
 */
export function useLibraryItems(kind: LibraryItemType): LibraryItem[] {
  const db = useDatabase();
  const ownerId = useOwnerId();
  const tagMap = useItemTagMap(kind);
  const { data: noteRows } = useLiveQuery(
    db
      .select({
        id: notes.id,
        title: notes.title,
        folderId: notes.folderId,
        pinned: notes.pinned,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        // Only the start of the text: enough for the preview line, cheap for long notes.
        textStart: sql<string>`substr(${notes.contentText}, 1, 200)`,
      })
      .from(notes)
      .where(and(eq(notes.ownerId, ownerId), isNull(notes.deletedAt))),
    [ownerId],
  );
  return useMemo(() => {
    const rows: Omit<LibraryItem, 'tagIds'>[] =
      kind === 'note'
        ? noteRows.map((note) => ({
            type: 'note',
            id: note.id,
            name: note.title || strings.notes.untitled,
            folderId: note.folderId ?? null,
            pinned: note.pinned,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            preview: notePreview(note.textStart ?? ''),
          }))
        : [];
    return rows.map((row) => ({ ...row, tagIds: tagMap.get(row.id) ?? [] }));
  }, [kind, noteRows, tagMap]);
}

/** The Library's sort order, remembered on this phone. */
export function useLibrarySort(): [LibrarySort, (sort: LibrarySort) => void] {
  const db = useDatabase();
  const [sort, setSort] = useState<LibrarySort>(DEFAULT_LIBRARY_SORT);

  useEffect(() => {
    let cancelled = false;
    getSetting(db, SORT_SETTING)
      .then((saved) => {
        if (!cancelled && isLibrarySort(saved)) setSort(saved);
      })
      .catch((error: unknown) =>
        log.warn('Could not read the sort order', { error: String(error) }),
      );
    return () => {
      cancelled = true;
    };
  }, [db]);

  const change = useCallback(
    (next: LibrarySort) => {
      setSort(next);
      setSetting(db, SORT_SETTING, next).catch((error: unknown) =>
        log.warn('Could not save the sort order', { error: String(error) }),
      );
    },
    [db],
  );
  return [sort, change];
}

/** Folder and tag changes, bound to the database and the profile. */
export function useLibraryActions() {
  const db = useDatabase();
  const ownerId = useOwnerId();
  return useMemo(
    () => ({
      createFolder: (kind: LibraryItemType, name: string, parentId: string | null) =>
        repo.createFolder(db, { ownerId, kind, name, parentId }),
      renameFolder: (id: string, name: string) => repo.renameFolder(db, id, name),
      moveFolder: (id: string, parentId: string | null) => repo.moveFolder(db, id, parentId),
      deleteFolder: (id: string) => repo.deleteFolder(db, id),
      restoreFolders: (deleted: repo.DeletedFolders) => repo.restoreFolders(db, deleted),
      createTag: (name: string, colour: TagColour) => repo.createTag(db, { ownerId, name, colour }),
      updateTag: (id: string, changes: { name?: string; colour?: TagColour }) =>
        repo.updateTag(db, id, changes),
      deleteTag: (id: string) => repo.deleteTag(db, id),
      restoreTag: (id: string) => repo.restoreTag(db, id),
      setItemTags: (itemType: LibraryItemType, itemId: string, tagIds: readonly string[]) =>
        repo.setItemTags(db, { ownerId, itemType, itemId }, tagIds),
      // Items: only notes exist so far; decks (1.6) and quizzes (1.10) add their cases.
      createNote: (folderId: string | null) => notesRepo.createNote(db, { ownerId, folderId }),
      moveItem: (item: ItemKey, folderId: string | null) =>
        forItem(item, () => notesRepo.moveNote(db, item.id, folderId)),
      setItemPinned: (item: ItemKey, pinned: boolean) =>
        forItem(item, () => notesRepo.setNotePinned(db, item.id, pinned)),
      deleteItem: (item: ItemKey) =>
        forItem(item, async () => {
          await notesRepo.deleteNote(db, item.id);
        }),
      restoreItem: (item: ItemKey) => forItem(item, () => notesRepo.restoreNote(db, item.id)),
    }),
    [db, ownerId],
  );
}

export type LibraryActions = ReturnType<typeof useLibraryActions>;

type ItemKey = Pick<LibraryItem, 'type' | 'id'>;

function forItem(item: ItemKey, note: () => Promise<void>): Promise<void> {
  if (item.type === 'note') return note();
  return Promise.reject(new Error(`${item.type} items arrive in a later task`));
}
