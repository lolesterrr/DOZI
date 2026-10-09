import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import {
  folders,
  itemTags,
  notes,
  tags,
  type Folder,
  type LibraryItemType,
  type Tag,
  type TagColour,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId as defaultNewId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

import { canMoveFolder, cleanName, groupTagIds, subtreeIds } from './logic';

type Deps = { newId?: () => string; now?: () => string };
type NowDep = Pick<Deps, 'now'>;

const isoNow = () => nowIso();

// ---------------------------------------------------------------------------------------------
// Folders

/** Every folder of one kind (Notes, Decks or Quizzes) that hasn't been deleted. */
export async function listFolders(
  db: AppDatabase,
  ownerId: string,
  kind: LibraryItemType,
): Promise<Folder[]> {
  return db
    .select()
    .from(folders)
    .where(and(eq(folders.ownerId, ownerId), eq(folders.kind, kind), isNull(folders.deletedAt)))
    .orderBy(asc(folders.name));
}

export async function getFolder(db: AppDatabase, id: string): Promise<Folder | undefined> {
  const rows = await db.select().from(folders).where(eq(folders.id, id)).limit(1);
  return rows[0];
}

export type NewFolderInput = {
  ownerId: string;
  kind: LibraryItemType;
  name: string;
  /** null or missing = top level. */
  parentId?: string | null;
};

export async function createFolder(
  db: AppDatabase,
  input: NewFolderInput,
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<Folder> {
  const timestamp = now();
  const [created] = await db
    .insert(folders)
    .values({
      id: newId(),
      ownerId: input.ownerId,
      kind: input.kind,
      name: cleanName(input.name),
      parentId: input.parentId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();
  return created;
}

export async function renameFolder(
  db: AppDatabase,
  id: string,
  name: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  await db
    .update(folders)
    .set({ name: cleanName(name), updatedAt: now(), dirty: true })
    .where(eq(folders.id, id));
}

/**
 * Moves a folder (with everything inside it) into another folder of the same kind, or to the
 * top level (null). Refuses to move a folder into itself or one of its own subfolders.
 */
export async function moveFolder(
  db: AppDatabase,
  id: string,
  newParentId: string | null,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const folder = await getFolder(db, id);
  if (!folder || folder.deletedAt) throw new Error('That folder no longer exists');
  const siblings = await listFolders(db, folder.ownerId, folder.kind);
  if (!canMoveFolder(siblings, id, newParentId)) {
    throw new Error('A folder can’t be moved inside itself');
  }
  await db
    .update(folders)
    .set({ parentId: newParentId, updatedAt: now(), dirty: true })
    .where(eq(folders.id, id));
}

/** What `deleteFolder` removed, so `restoreFolders` can put exactly that back. */
export type DeletedFolders = { ids: string[]; deletedAt: string; kind?: LibraryItemType };

/**
 * Soft-deletes a folder, every folder inside it and the items in all of them, with one shared
 * timestamp. Notes follow now; decks (1.6) and quizzes (1.10) join when their tables exist.
 */
export async function deleteFolder(
  db: AppDatabase,
  id: string,
  { now = isoNow }: NowDep = {},
): Promise<DeletedFolders> {
  const folder = await getFolder(db, id);
  if (!folder || folder.deletedAt) return { ids: [], deletedAt: now() };
  const all = await listFolders(db, folder.ownerId, folder.kind);
  const ids = [...subtreeIds(all, id)];
  const deletedAt = now();
  await db
    .update(folders)
    .set({ deletedAt, updatedAt: deletedAt, dirty: true })
    .where(and(inArray(folders.id, ids), isNull(folders.deletedAt)));
  if (folder.kind === 'note') {
    await db
      .update(notes)
      .set({ deletedAt, updatedAt: deletedAt, dirty: true })
      .where(and(inArray(notes.folderId, ids), isNull(notes.deletedAt)));
  }
  return { ids, deletedAt, kind: folder.kind };
}

/** Undoes `deleteFolder`. Folders and items deleted at another time (separately) stay deleted. */
export async function restoreFolders(
  db: AppDatabase,
  deleted: DeletedFolders,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  if (deleted.ids.length === 0) return;
  const timestamp = now();
  await db
    .update(folders)
    .set({ deletedAt: null, updatedAt: timestamp, dirty: true })
    .where(and(inArray(folders.id, deleted.ids), eq(folders.deletedAt, deleted.deletedAt)));
  if (deleted.kind === undefined || deleted.kind === 'note') {
    await db
      .update(notes)
      .set({ deletedAt: null, updatedAt: timestamp, dirty: true })
      .where(and(inArray(notes.folderId, deleted.ids), eq(notes.deletedAt, deleted.deletedAt)));
  }
}

// ---------------------------------------------------------------------------------------------
// Tags

/** Every tag that hasn't been deleted, A–Z. */
export async function listTags(db: AppDatabase, ownerId: string): Promise<Tag[]> {
  return db
    .select()
    .from(tags)
    .where(and(eq(tags.ownerId, ownerId), isNull(tags.deletedAt)))
    .orderBy(asc(tags.name));
}

export async function getTag(db: AppDatabase, id: string): Promise<Tag | undefined> {
  const rows = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  return rows[0];
}

export async function createTag(
  db: AppDatabase,
  input: { ownerId: string; name: string; colour?: TagColour },
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<Tag> {
  const timestamp = now();
  const [created] = await db
    .insert(tags)
    .values({
      id: newId(),
      ownerId: input.ownerId,
      name: cleanName(input.name),
      colour: input.colour ?? 'teal',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();
  return created;
}

export async function updateTag(
  db: AppDatabase,
  id: string,
  changes: { name?: string; colour?: TagColour },
  { now = isoNow }: NowDep = {},
): Promise<void> {
  await db
    .update(tags)
    .set({
      ...(changes.name !== undefined ? { name: cleanName(changes.name) } : {}),
      ...(changes.colour !== undefined ? { colour: changes.colour } : {}),
      updatedAt: now(),
      dirty: true,
    })
    .where(eq(tags.id, id));
}

/**
 * Soft-deletes a tag. Its links to items are kept (hidden while the tag is deleted), so undo
 * brings the tag back on every item it was on.
 */
export async function deleteTag(db: AppDatabase, id: string, { now = isoNow }: NowDep = {}) {
  const timestamp = now();
  await db
    .update(tags)
    .set({ deletedAt: timestamp, updatedAt: timestamp, dirty: true })
    .where(and(eq(tags.id, id), isNull(tags.deletedAt)));
}

export async function restoreTag(db: AppDatabase, id: string, { now = isoNow }: NowDep = {}) {
  await db
    .update(tags)
    .set({ deletedAt: null, updatedAt: now(), dirty: true })
    .where(eq(tags.id, id));
}

// ---------------------------------------------------------------------------------------------
// Tags on items

export type ItemRef = { ownerId: string; itemType: LibraryItemType; itemId: string };

/** Puts a tag on an item. Re-adding a removed tag revives the same row. */
export async function addTagToItem(
  db: AppDatabase,
  item: ItemRef,
  tagId: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const timestamp = now();
  await db
    .insert(itemTags)
    .values({ ...item, tagId, createdAt: timestamp, updatedAt: timestamp })
    .onConflictDoUpdate({
      target: [itemTags.itemType, itemTags.itemId, itemTags.tagId],
      set: { deletedAt: null, updatedAt: timestamp, dirty: true },
    });
}

export async function removeTagFromItem(
  db: AppDatabase,
  item: Omit<ItemRef, 'ownerId'>,
  tagId: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const timestamp = now();
  await db
    .update(itemTags)
    .set({ deletedAt: timestamp, updatedAt: timestamp, dirty: true })
    .where(
      and(
        eq(itemTags.itemType, item.itemType),
        eq(itemTags.itemId, item.itemId),
        eq(itemTags.tagId, tagId),
        isNull(itemTags.deletedAt),
      ),
    );
}

/** Ids of the (non-deleted) tags on one item. */
export async function listItemTagIds(
  db: AppDatabase,
  item: Omit<ItemRef, 'ownerId'>,
): Promise<string[]> {
  const rows = await db
    .select({ tagId: itemTags.tagId })
    .from(itemTags)
    .innerJoin(tags, eq(tags.id, itemTags.tagId))
    .where(
      and(
        eq(itemTags.itemType, item.itemType),
        eq(itemTags.itemId, item.itemId),
        isNull(itemTags.deletedAt),
        isNull(tags.deletedAt),
      ),
    )
    .orderBy(asc(tags.name));
  return rows.map((r) => r.tagId);
}

/** Makes an item carry exactly these tags: adds the missing ones and removes the rest. */
export async function setItemTags(
  db: AppDatabase,
  item: ItemRef,
  tagIds: readonly string[],
  deps: NowDep = {},
): Promise<void> {
  const current = await listItemTagIds(db, item);
  for (const tagId of tagIds) {
    if (!current.includes(tagId)) await addTagToItem(db, item, tagId, deps);
  }
  for (const tagId of current) {
    if (!tagIds.includes(tagId)) await removeTagFromItem(db, item, tagId, deps);
  }
}

/** For one kind of item: item id → its tag ids. What the Library's tag filter needs. */
export async function itemTagMap(
  db: AppDatabase,
  ownerId: string,
  itemType: LibraryItemType,
): Promise<Map<string, string[]>> {
  const rows = await db
    .select({ itemId: itemTags.itemId, tagId: itemTags.tagId })
    .from(itemTags)
    .innerJoin(tags, eq(tags.id, itemTags.tagId))
    .where(
      and(
        eq(itemTags.ownerId, ownerId),
        eq(itemTags.itemType, itemType),
        isNull(itemTags.deletedAt),
        isNull(tags.deletedAt),
      ),
    );
  return groupTagIds(rows);
}
