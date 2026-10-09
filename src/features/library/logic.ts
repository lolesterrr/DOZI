// The Library's pure rules: names, folder trees, moves, sorting and tag filters
// (PRODUCT_SPEC §4, ARCHITECTURE §3.3). No React and no database, so all of it is unit-tested.

import type { Folder, LibraryItemType, Tag, TagColour } from '@/db/schema';
import type { ColorName } from '@/theme';

export const FOLDER_NAME_MAX = 60;
export const TAG_NAME_MAX = 30;

/** The Library's segments, in the order they appear: Notes · Decks · Quizzes. */
export const librarySegments: readonly LibraryItemType[] = ['note', 'deck', 'quiz'];

// ---------------------------------------------------------------------------------------------
// Names

/** Trims and collapses runs of spaces, so "  Beta   blockers " and "Beta blockers" match. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function sameName(a: string, b: string): boolean {
  return cleanName(a).localeCompare(cleanName(b), undefined, { sensitivity: 'base' }) === 0;
}

export type NameProblem = 'empty' | 'tooLong' | 'duplicate';

type Named = { id: string; name: string };

function checkName(
  name: string,
  max: number,
  others: readonly Named[],
  ignoreId?: string,
): NameProblem | null {
  const cleaned = cleanName(name);
  if (!cleaned) return 'empty';
  if (cleaned.length > max) return 'tooLong';
  if (others.some((o) => o.id !== ignoreId && sameName(o.name, cleaned))) return 'duplicate';
  return null;
}

/**
 * Checks a folder name against the other folders **in the same place** (same parent).
 * Pass `ignoreId` when renaming, so the folder doesn't clash with itself.
 */
export function folderNameProblem(
  name: string,
  siblings: readonly Named[],
  ignoreId?: string,
): NameProblem | null {
  return checkName(name, FOLDER_NAME_MAX, siblings, ignoreId);
}

/** Checks a tag name against every other tag (tag names are unique, ignoring case). */
export function tagNameProblem(
  name: string,
  tags: readonly Named[],
  ignoreId?: string,
): NameProblem | null {
  return checkName(name, TAG_NAME_MAX, tags, ignoreId);
}

// ---------------------------------------------------------------------------------------------
// Folder trees

type TreeFolder = Pick<Folder, 'id' | 'parentId' | 'name'>;

/** Folders directly inside `parentId` (null = top level). */
export function childFolders<F extends TreeFolder>(
  folders: readonly F[],
  parentId: string | null,
): F[] {
  return folders.filter((f) => (f.parentId ?? null) === parentId);
}

/** The folder and everything nested inside it (ids). */
export function subtreeIds(folders: readonly TreeFolder[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  // Repeat until nothing new is added; copes with any order and ignores cycles.
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
}

/**
 * The path from the top level down to `folderId` (inclusive), for the breadcrumb.
 * A folder whose parent is missing (deleted, not synced yet) is treated as top level.
 */
export function folderPath<F extends TreeFolder>(folders: readonly F[], folderId: string): F[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: F[] = [];
  const seen = new Set<string>();
  let current = byId.get(folderId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/** Can `folderId` be moved into `newParentId` (null = top level)? Not into itself or a child. */
export function canMoveFolder(
  folders: readonly TreeFolder[],
  folderId: string,
  newParentId: string | null,
): boolean {
  if (newParentId === null) return true;
  if (!folders.some((f) => f.id === newParentId)) return false;
  return !subtreeIds(folders, folderId).has(newParentId);
}

export type FolderTreeRow<F> = { folder: F; depth: number };

/**
 * Every folder in tree order (each parent followed by its children, A–Z), with its depth.
 * `excludeId` leaves out that folder and everything inside it: used by "Move to…", where a
 * folder can't go inside itself.
 */
export function folderTree<F extends TreeFolder>(
  folders: readonly F[],
  excludeId?: string,
): FolderTreeRow<F>[] {
  const excluded = excludeId ? subtreeIds(folders, excludeId) : new Set<string>();
  const ids = new Set(folders.map((f) => f.id));
  const rows: FolderTreeRow<F>[] = [];
  const visit = (parentId: string | null, depth: number) => {
    const children = folders
      .filter((f) => !excluded.has(f.id))
      .filter((f) =>
        parentId === null ? !f.parentId || !ids.has(f.parentId) : f.parentId === parentId,
      )
      .sort((a, b) => compareNames(a.name, b.name));
    for (const folder of children) {
      rows.push({ folder, depth });
      visit(folder.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Sorting

export const librarySorts = ['name-asc', 'name-desc', 'updated', 'created'] as const;
export type LibrarySort = (typeof librarySorts)[number];
export const DEFAULT_LIBRARY_SORT: LibrarySort = 'updated';

/** For values read back from settings (stored as JSON, so the shape isn't guaranteed). */
export function isLibrarySort(value: unknown): value is LibrarySort {
  return typeof value === 'string' && (librarySorts as readonly string[]).includes(value);
}

/** Natural, case-insensitive order: "Week 2" before "Week 10". */
export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

type Sortable = { name: string; createdAt: string; updatedAt: string };

/** Returns a sorted copy. Dates are ISO strings, so text order is time order. Newest first. */
export function sortEntries<T extends Sortable>(entries: readonly T[], sort: LibrarySort): T[] {
  const byName = (a: T, b: T) => compareNames(a.name, b.name);
  const copy = [...entries];
  switch (sort) {
    case 'name-asc':
      return copy.sort(byName);
    case 'name-desc':
      return copy.sort((a, b) => byName(b, a));
    case 'updated':
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || byName(a, b));
    case 'created':
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byName(a, b));
  }
}

// ---------------------------------------------------------------------------------------------
// Items and tag filters

/**
 * A note, deck or quiz as the Library shows it. The item tables arrive with their own tasks
 * (notes 1.3, decks 1.6, quizzes 1.10); each one maps its rows to this shape.
 */
export type LibraryItem = {
  type: LibraryItemType;
  id: string;
  /** The title, used for sorting by name. */
  name: string;
  folderId: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  tagIds: readonly string[];
  /** A short line under the name, e.g. the start of a note. */
  preview?: string;
};

/** Items that carry **every** selected tag. No tags selected = everything. */
export function filterByTags<T extends Pick<LibraryItem, 'tagIds'>>(
  items: readonly T[],
  selectedTagIds: readonly string[],
): T[] {
  if (selectedTagIds.length === 0) return [...items];
  return items.filter((item) => selectedTagIds.every((id) => item.tagIds.includes(id)));
}

/** Pinned items first, then the chosen sort. */
export function sortItems<T extends LibraryItem>(items: readonly T[], sort: LibrarySort): T[] {
  const sorted = sortEntries(items, sort);
  return [...sorted.filter((i) => i.pinned), ...sorted.filter((i) => !i.pinned)];
}

/** Drops selected tag ids whose tag no longer exists (e.g. it was just deleted). */
export function keepExistingTags(
  selectedTagIds: readonly string[],
  tags: readonly Pick<Tag, 'id'>[],
): string[] {
  const ids = new Set(tags.map((t) => t.id));
  return selectedTagIds.filter((id) => ids.has(id));
}

/** Turns (item, tag) link rows into item id → tag ids. */
export function groupTagIds(
  rows: readonly { itemId: string; tagId: string }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const { itemId, tagId } of rows) {
    const list = map.get(itemId);
    if (list) list.push(tagId);
    else map.set(itemId, [tagId]);
  }
  return map;
}

/** Adds or removes one id from a selection. */
export function toggleId(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
}

// ---------------------------------------------------------------------------------------------
// Tag colours → theme tokens (background, text). Every pair is AA-checked in the theme tests.

export const tagColourTokens: Record<TagColour, { bg: ColorName; fg: ColorName }> = {
  teal: { bg: 'primary-soft', fg: 'on-primary-soft' },
  gold: { bg: 'accent-soft', fg: 'on-accent-soft' },
  green: { bg: 'success-soft', fg: 'on-success-soft' },
  red: { bg: 'danger-soft', fg: 'on-danger-soft' },
  amber: { bg: 'warning-soft', fg: 'on-warning-soft' },
  grey: { bg: 'surface-muted', fg: 'fg' },
};
