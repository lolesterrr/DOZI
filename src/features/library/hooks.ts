import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { folders, itemTags, tags, type LibraryItemType, type TagColour } from '@/db/schema';
import { useProfile } from '@/features/profile/hooks';
import { getSetting, setSetting } from '@/features/settings';
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
 * Every note, deck or quiz of one kind, with its tags. Empty until the item tables exist:
 * notes arrive in task 1.3, decks in 1.6 and quizzes in 1.10. Each of those tasks adds a live
 * query here that maps its rows to `LibraryItem` and fills `tagIds` from `useItemTagMap`.
 */
export function useLibraryItems(kind: LibraryItemType): LibraryItem[] {
  const tagMap = useItemTagMap(kind);
  return useMemo(() => {
    const rows: Omit<LibraryItem, 'tagIds'>[] = [];
    return rows.map((row) => ({ ...row, tagIds: tagMap.get(row.id) ?? [] }));
  }, [tagMap]);
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
    }),
    [db, ownerId],
  );
}

export type LibraryActions = ReturnType<typeof useLibraryActions>;
