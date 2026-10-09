import {
  addTagToItem,
  createFolder,
  createTag,
  deleteFolder,
  deleteTag,
  getFolder,
  itemTagMap,
  listFolders,
  listItemTagIds,
  listTags,
  moveFolder,
  removeTagFromItem,
  renameFolder,
  restoreFolders,
  restoreTag,
  setItemTags,
  updateTag,
} from '../repo';
import { createTestDatabase } from '@/test-utils/db';

const owner = 'owner-1';

function at(time: string) {
  return { now: () => time };
}

async function makeTree() {
  const db = createTestDatabase();
  const pharm = await createFolder(db, { ownerId: owner, kind: 'note', name: 'Pharm I' });
  const ans = await createFolder(db, {
    ownerId: owner,
    kind: 'note',
    name: 'ANS',
    parentId: pharm.id,
  });
  const adr = await createFolder(db, {
    ownerId: owner,
    kind: 'note',
    name: 'Adrenergic',
    parentId: ans.id,
  });
  return { db, pharm, ans, adr };
}

describe('folders', () => {
  it('creates a folder with clean name and sync defaults', async () => {
    const db = createTestDatabase();
    const folder = await createFolder(
      db,
      { ownerId: owner, kind: 'deck', name: '  CNS   drugs ' },
      { newId: () => 'f1', now: () => '2026-10-09T10:00:00.000Z' },
    );
    expect(folder).toMatchObject({
      id: 'f1',
      name: 'CNS drugs',
      kind: 'deck',
      parentId: null,
      sortOrder: 0,
      deletedAt: null,
      dirty: true,
      createdAt: '2026-10-09T10:00:00.000Z',
    });
  });

  it('keeps each kind separate', async () => {
    const { db } = await makeTree();
    await createFolder(db, { ownerId: owner, kind: 'quiz', name: 'Mocks' });
    expect((await listFolders(db, owner, 'note')).map((x) => x.name)).toEqual([
      'ANS',
      'Adrenergic',
      'Pharm I',
    ]);
    expect((await listFolders(db, owner, 'quiz')).map((x) => x.name)).toEqual(['Mocks']);
    expect(await listFolders(db, 'someone-else', 'note')).toEqual([]);
  });

  it('renames', async () => {
    const { db, ans } = await makeTree();
    await renameFolder(db, ans.id, ' Autonomic ', at('2026-10-10T00:00:00.000Z'));
    expect(await getFolder(db, ans.id)).toMatchObject({
      name: 'Autonomic',
      updatedAt: '2026-10-10T00:00:00.000Z',
      dirty: true,
    });
  });

  it('moves a folder and refuses to move it inside itself', async () => {
    const { db, pharm, ans, adr } = await makeTree();
    await moveFolder(db, adr.id, null);
    expect((await getFolder(db, adr.id))?.parentId).toBeNull();
    await expect(moveFolder(db, pharm.id, ans.id)).rejects.toThrow();
    expect((await getFolder(db, pharm.id))?.parentId).toBeNull();
  });

  it('deletes a folder with its subfolders and undoes it', async () => {
    const { db, pharm, ans, adr } = await makeTree();
    const other = await createFolder(db, { ownerId: owner, kind: 'note', name: 'Other' });

    const deleted = await deleteFolder(db, ans.id, at('2026-10-10T00:00:00.000Z'));
    expect(deleted.ids.sort()).toEqual([adr.id, ans.id].sort());
    expect((await listFolders(db, owner, 'note')).map((x) => x.id).sort()).toEqual(
      [pharm.id, other.id].sort(),
    );

    await restoreFolders(db, deleted);
    expect(await listFolders(db, owner, 'note')).toHaveLength(4);
  });

  it('undo leaves folders deleted earlier on their own alone', async () => {
    const { db, ans, adr } = await makeTree();
    const first = await deleteFolder(db, adr.id, at('2026-10-10T00:00:00.000Z'));
    const second = await deleteFolder(db, ans.id, at('2026-10-10T00:05:00.000Z'));
    expect(second.ids.sort()).toEqual([ans.id]);
    await restoreFolders(db, second);
    expect((await getFolder(db, adr.id))?.deletedAt).toBe('2026-10-10T00:00:00.000Z');
    await restoreFolders(db, first);
    expect((await getFolder(db, adr.id))?.deletedAt).toBeNull();
  });
});

describe('tags', () => {
  it('creates, updates, deletes and restores tags', async () => {
    const db = createTestDatabase();
    const exam = await createTag(db, { ownerId: owner, name: ' Exam ' });
    await createTag(db, { ownerId: owner, name: 'ANS', colour: 'gold' });
    expect(exam).toMatchObject({ name: 'Exam', colour: 'teal', deletedAt: null });

    await updateTag(db, exam.id, { name: 'Exam 1', colour: 'red' });
    expect((await listTags(db, owner)).map((t) => [t.name, t.colour])).toEqual([
      ['ANS', 'gold'],
      ['Exam 1', 'red'],
    ]);

    await deleteTag(db, exam.id);
    expect((await listTags(db, owner)).map((t) => t.name)).toEqual(['ANS']);
    await restoreTag(db, exam.id);
    expect(await listTags(db, owner)).toHaveLength(2);
  });

  it('tags items, revives removed links and hides deleted tags', async () => {
    const db = createTestDatabase();
    const exam = await createTag(db, { ownerId: owner, name: 'Exam' });
    const ans = await createTag(db, { ownerId: owner, name: 'ANS' });
    const note = { ownerId: owner, itemType: 'note' as const, itemId: 'n1' };

    await addTagToItem(db, note, exam.id);
    await addTagToItem(db, note, exam.id); // twice is fine
    await addTagToItem(db, note, ans.id);
    expect(await listItemTagIds(db, note)).toEqual([ans.id, exam.id]);

    await removeTagFromItem(db, note, ans.id);
    expect(await listItemTagIds(db, note)).toEqual([exam.id]);
    await addTagToItem(db, note, ans.id);
    expect(await listItemTagIds(db, note)).toEqual([ans.id, exam.id]);

    await deleteTag(db, exam.id);
    expect(await listItemTagIds(db, note)).toEqual([ans.id]);
    await restoreTag(db, exam.id);
    expect(await listItemTagIds(db, note)).toEqual([ans.id, exam.id]);
  });

  it('sets the exact tag list and maps tags per item type', async () => {
    const db = createTestDatabase();
    const [a, b, c] = await Promise.all(
      ['A', 'B', 'C'].map((name) => createTag(db, { ownerId: owner, name })),
    );
    const n1 = { ownerId: owner, itemType: 'note' as const, itemId: 'n1' };
    const n2 = { ownerId: owner, itemType: 'note' as const, itemId: 'n2' };
    const d1 = { ownerId: owner, itemType: 'deck' as const, itemId: 'd1' };

    await setItemTags(db, n1, [a.id, b.id]);
    await setItemTags(db, n1, [b.id, c.id]);
    await setItemTags(db, n2, [a.id]);
    await setItemTags(db, d1, [c.id]);

    expect((await listItemTagIds(db, n1)).sort()).toEqual([b.id, c.id].sort());
    const map = await itemTagMap(db, owner, 'note');
    expect(map.get('n1')?.sort()).toEqual([b.id, c.id].sort());
    expect(map.get('n2')).toEqual([a.id]);
    expect(map.has('d1')).toBe(false);
  });
});
