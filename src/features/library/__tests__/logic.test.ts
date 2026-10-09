import {
  canMoveFolder,
  childFolders,
  cleanName,
  filterByTags,
  folderNameProblem,
  folderPath,
  folderTree,
  groupTagIds,
  isLibrarySort,
  keepExistingTags,
  sortEntries,
  sortItems,
  subtreeIds,
  tagColourTokens,
  tagNameProblem,
  toggleId,
  type LibraryItem,
} from '../logic';
import { tagColours } from '@/db/schema';
import { palettes } from '@/theme';
import { contrastRatio } from '@/theme/contrast';

// A small tree:
//   Pharm I
//   ├─ ANS
//   │  └─ Adrenergic
//   └─ CVS
//   Pharm II
const f = (id: string, name: string, parentId: string | null = null) => ({ id, name, parentId });
const tree = [
  f('p1', 'Pharm I'),
  f('ans', 'ANS', 'p1'),
  f('adr', 'Adrenergic', 'ans'),
  f('cvs', 'CVS', 'p1'),
  f('p2', 'Pharm II'),
];

describe('names', () => {
  it('cleans spaces', () => {
    expect(cleanName('  Beta   blockers ')).toBe('Beta blockers');
  });

  it('flags empty, too long and duplicate folder names', () => {
    const siblings = [f('a', 'Week 1')];
    expect(folderNameProblem('   ', siblings)).toBe('empty');
    expect(folderNameProblem('x'.repeat(61), siblings)).toBe('tooLong');
    expect(folderNameProblem('x'.repeat(60), siblings)).toBeNull();
    expect(folderNameProblem(' week  1 ', siblings)).toBe('duplicate');
    expect(folderNameProblem('Week 2', siblings)).toBeNull();
  });

  it('lets a folder keep its own name when renaming', () => {
    expect(folderNameProblem('Week 1', [f('a', 'Week 1')], 'a')).toBeNull();
  });

  it('checks tag names, ignoring case', () => {
    const tags = [f('t1', 'Exam')];
    expect(tagNameProblem('EXAM', tags)).toBe('duplicate');
    expect(tagNameProblem('exam', tags, 't1')).toBeNull();
    expect(tagNameProblem('x'.repeat(31), tags)).toBe('tooLong');
  });
});

describe('folder trees', () => {
  it('finds children of a folder or the top level', () => {
    expect(childFolders(tree, null).map((x) => x.id)).toEqual(['p1', 'p2']);
    expect(childFolders(tree, 'p1').map((x) => x.id)).toEqual(['ans', 'cvs']);
  });

  it('collects a subtree whatever the row order', () => {
    expect([...subtreeIds([...tree].reverse(), 'p1')].sort()).toEqual(['adr', 'ans', 'cvs', 'p1']);
    expect([...subtreeIds(tree, 'p2')]).toEqual(['p2']);
  });

  it('builds the breadcrumb path', () => {
    expect(folderPath(tree, 'adr').map((x) => x.name)).toEqual(['Pharm I', 'ANS', 'Adrenergic']);
    expect(folderPath(tree, 'missing')).toEqual([]);
  });

  it('survives a corrupt cycle', () => {
    const loop = [f('a', 'A', 'b'), f('b', 'B', 'a')];
    expect(folderPath(loop, 'a').map((x) => x.id)).toEqual(['b', 'a']);
    expect([...subtreeIds(loop, 'a')].sort()).toEqual(['a', 'b']);
  });

  it('never moves a folder into itself or its subfolders', () => {
    expect(canMoveFolder(tree, 'p1', 'p1')).toBe(false);
    expect(canMoveFolder(tree, 'p1', 'adr')).toBe(false);
    expect(canMoveFolder(tree, 'ans', 'p2')).toBe(true);
    expect(canMoveFolder(tree, 'adr', null)).toBe(true);
    expect(canMoveFolder(tree, 'adr', 'deleted-folder')).toBe(false);
  });

  it('lists the tree in order with depths, leaving out the folder being moved', () => {
    expect(folderTree(tree).map((r) => `${r.depth}:${r.folder.name}`)).toEqual([
      '0:Pharm I',
      '1:ANS',
      '2:Adrenergic',
      '1:CVS',
      '0:Pharm II',
    ]);
    expect(folderTree(tree, 'ans').map((r) => r.folder.id)).toEqual(['p1', 'cvs', 'p2']);
  });

  it('shows a folder whose parent is gone at the top level', () => {
    expect(folderTree([f('orphan', 'Orphan', 'gone')]).map((r) => r.depth)).toEqual([0]);
  });
});

describe('sorting', () => {
  const entries = [
    { name: 'Week 10', createdAt: '2026-10-01', updatedAt: '2026-10-05' },
    { name: 'week 2', createdAt: '2026-10-03', updatedAt: '2026-10-04' },
    { name: 'Anatomy', createdAt: '2026-10-02', updatedAt: '2026-10-06' },
  ];
  const names = (sort: Parameters<typeof sortEntries>[1]) =>
    sortEntries(entries, sort).map((e) => e.name);

  it('sorts by name naturally, ignoring case', () => {
    expect(names('name-asc')).toEqual(['Anatomy', 'week 2', 'Week 10']);
    expect(names('name-desc')).toEqual(['Week 10', 'week 2', 'Anatomy']);
  });

  it('sorts newest first by updated or created time', () => {
    expect(names('updated')).toEqual(['Anatomy', 'Week 10', 'week 2']);
    expect(names('created')).toEqual(['week 2', 'Anatomy', 'Week 10']);
  });

  it('does not change the input', () => {
    sortEntries(entries, 'name-asc');
    expect(entries[0].name).toBe('Week 10');
  });

  it('recognises saved sort values', () => {
    expect(isLibrarySort('updated')).toBe(true);
    expect(isLibrarySort('size')).toBe(false);
    expect(isLibrarySort(undefined)).toBe(false);
  });
});

describe('items and tags', () => {
  const item = (id: string, tagIds: string[], pinned = false): LibraryItem => ({
    type: 'note',
    id,
    name: id,
    folderId: null,
    pinned,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
    tagIds,
  });

  it('keeps items with every selected tag', () => {
    const items = [item('a', ['exam', 'ans']), item('b', ['exam']), item('c', [])];
    expect(filterByTags(items, []).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(filterByTags(items, ['exam']).map((i) => i.id)).toEqual(['a', 'b']);
    expect(filterByTags(items, ['exam', 'ans']).map((i) => i.id)).toEqual(['a']);
  });

  it('puts pinned items first', () => {
    const items = [item('b', []), item('c', [], true), item('a', [])];
    expect(sortItems(items, 'name-asc').map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('drops filters for deleted tags and toggles selections', () => {
    expect(keepExistingTags(['a', 'gone'], [{ id: 'a' }])).toEqual(['a']);
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('groups link rows by item', () => {
    const map = groupTagIds([
      { itemId: 'n1', tagId: 't1' },
      { itemId: 'n2', tagId: 't1' },
      { itemId: 'n1', tagId: 't2' },
    ]);
    expect(map.get('n1')).toEqual(['t1', 't2']);
    expect(map.get('n2')).toEqual(['t1']);
  });

  it.each(tagColours)('tag colour %s is readable (AA) in light and dark', (colour) => {
    const { bg, fg } = tagColourTokens[colour];
    for (const scheme of ['light', 'dark'] as const) {
      expect(contrastRatio(palettes[scheme][fg], palettes[scheme][bg])).toBeGreaterThanOrEqual(4.5);
    }
  });
});
