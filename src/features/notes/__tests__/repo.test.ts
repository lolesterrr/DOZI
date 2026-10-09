import { createFolder, deleteFolder, restoreFolders } from '@/features/library/repo';
import { createTestDatabase } from '@/test-utils/db';

import { emptyDoc, NOTE_VERSION_LIMIT, type DocNode } from '../logic';
import {
  createNote,
  deleteNote,
  discardIfBlank,
  getNote,
  listNotes,
  listNoteVersions,
  moveNote,
  restoreNote,
  restoreNoteVersion,
  saveNoteContent,
  setNotePinned,
  setNoteTitle,
} from '../repo';

// SAMPLE content for tests only — not reviewed pharmacology.
const owner = 'owner-1';
const at = (time: string) => ({ now: () => time });
const minutes = (n: number) => new Date(Date.UTC(2026, 9, 9, 10, n)).toISOString();

const doc = (...lines: string[]): DocNode => ({
  type: 'doc',
  content: lines.map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] })),
});

let ids = 0;
const newId = () => `id-${++ids}`;

describe('notes', () => {
  it('creates a blank note with sync defaults', async () => {
    const db = createTestDatabase();
    const note = await createNote(
      db,
      { ownerId: owner, title: '  ANS  overview ' },
      { newId: () => 'n1', now: () => minutes(0) },
    );
    expect(note).toMatchObject({
      id: 'n1',
      title: 'ANS overview',
      folderId: null,
      contentText: '',
      wordCount: 0,
      pinned: false,
      template: null,
      deletedAt: null,
      dirty: true,
      createdAt: minutes(0),
      updatedAt: minutes(0),
    });
    expect(JSON.parse(note.contentJson)).toEqual(emptyDoc());
  });

  it('saves content with its text and word count, and skips unchanged content', async () => {
    const db = createTestDatabase();
    const note = await createNote(db, { ownerId: owner }, at(minutes(0)));
    expect(await saveNoteContent(db, note.id, doc('SAMPLE one two', 'three'), at(minutes(1)))).toBe(
      true,
    );
    const saved = await getNote(db, note.id);
    expect(saved).toMatchObject({
      contentText: 'SAMPLE one two\nthree',
      wordCount: 4,
      updatedAt: minutes(1),
    });
    expect(await saveNoteContent(db, note.id, doc('SAMPLE one two', 'three'), at(minutes(2)))).toBe(
      false,
    );
    expect((await getNote(db, note.id))?.updatedAt).toBe(minutes(1));
  });

  it('saves a note with text, a table and 2 images, and reads it back identically', async () => {
    // Roadmap 1.3 "done when", at the database level (the editor round trip is checked in
    // a browser during development: see the Decisions log).
    const db = createTestDatabase();
    const note = await createNote(db, { ownerId: owner });
    const body: DocNode = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'SAMPLE text' }] },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Drug' }] }],
                },
              ],
            },
          ],
        },
        { type: 'image', attrs: { src: 'media://a', alt: null, title: null } },
        { type: 'image', attrs: { src: 'media://b', alt: null, title: null } },
      ],
    };
    await saveNoteContent(db, note.id, body);
    const reopened = await getNote(db, note.id);
    expect(JSON.parse(reopened!.contentJson)).toEqual(body);
  });

  it('keeps versions a few minutes apart, and only the last ten', async () => {
    const db = createTestDatabase();
    const note = await createNote(db, { ownerId: owner }, { newId, now: () => minutes(0) });
    // The blank starting content is never a version.
    await saveNoteContent(db, note.id, doc('v1'), { newId, now: () => minutes(0) });
    expect(await listNoteVersions(db, note.id)).toHaveLength(0);
    // Typing on: the content before this session is kept once…
    await saveNoteContent(db, note.id, doc('v2'), { newId, now: () => minutes(1) });
    await saveNoteContent(db, note.id, doc('v3'), { newId, now: () => minutes(2) });
    let versions = await listNoteVersions(db, note.id);
    expect(versions.map((v) => JSON.parse(v.contentJson))).toEqual([doc('v1')]);
    // …and again once five minutes have passed.
    await saveNoteContent(db, note.id, doc('v4'), { newId, now: () => minutes(6) });
    versions = await listNoteVersions(db, note.id);
    expect(versions.map((v) => JSON.parse(v.contentJson))).toEqual([doc('v3'), doc('v1')]);

    for (let i = 0; i < 12; i++) {
      await saveNoteContent(db, note.id, doc(`more ${i}`), {
        newId,
        now: () => minutes(10 + i * 5),
      });
    }
    versions = await listNoteVersions(db, note.id);
    expect(versions).toHaveLength(NOTE_VERSION_LIMIT);
    expect(JSON.parse(versions[0].contentJson)).toEqual(doc('more 10'));
  });

  it('restores a version and keeps the replaced content as a version', async () => {
    const db = createTestDatabase();
    const note = await createNote(db, { ownerId: owner }, { newId, now: () => minutes(0) });
    await saveNoteContent(db, note.id, doc('first'), { newId, now: () => minutes(0) });
    await saveNoteContent(db, note.id, doc('second'), { newId, now: () => minutes(1) });
    const [first] = await listNoteVersions(db, note.id);

    const restored = await restoreNoteVersion(db, note.id, first.id, {
      newId,
      now: () => minutes(2),
    });
    expect(restored).toEqual(doc('first'));
    expect((await getNote(db, note.id))?.contentText).toBe('first');
    const versions = await listNoteVersions(db, note.id);
    expect(versions.map((v) => JSON.parse(v.contentJson))).toEqual([doc('second'), doc('first')]);

    await expect(restoreNoteVersion(db, note.id, 'nope')).rejects.toThrow();
  });

  it('renames, pins, moves, deletes and restores', async () => {
    const db = createTestDatabase();
    const note = await createNote(db, { ownerId: owner });
    await setNoteTitle(db, note.id, ' Cholinergic  drugs ', at(minutes(1)));
    await setNotePinned(db, note.id, true, at(minutes(2)));
    await moveNote(db, note.id, 'folder-1', at(minutes(3)));
    expect(await getNote(db, note.id)).toMatchObject({
      title: 'Cholinergic drugs',
      pinned: true,
      folderId: 'folder-1',
      updatedAt: minutes(3),
    });

    await deleteNote(db, note.id, at(minutes(4)));
    expect(await listNotes(db, owner)).toHaveLength(0);
    // A deleted note isn't saved over.
    expect(await saveNoteContent(db, note.id, doc('late'))).toBe(false);
    await restoreNote(db, note.id);
    expect(await listNotes(db, owner)).toHaveLength(1);
  });

  it('discards a note that was left blank, and only then', async () => {
    const db = createTestDatabase();
    const blank = await createNote(db, { ownerId: owner });
    const titled = await createNote(db, { ownerId: owner, title: 'Kept' });
    const written = await createNote(db, { ownerId: owner });
    await saveNoteContent(db, written.id, doc('words'));

    expect(await discardIfBlank(db, blank.id)).toBe(true);
    expect(await discardIfBlank(db, titled.id)).toBe(false);
    expect(await discardIfBlank(db, written.id)).toBe(false);
    expect((await listNotes(db, owner)).map((n) => n.id).sort()).toEqual(
      [titled.id, written.id].sort(),
    );
  });
});

describe('notes inside deleted folders', () => {
  it('are deleted with the folder and come back with undo', async () => {
    const db = createTestDatabase();
    const parent = await createFolder(db, { ownerId: owner, kind: 'note', name: 'Pharm' });
    const child = await createFolder(db, {
      ownerId: owner,
      kind: 'note',
      name: 'ANS',
      parentId: parent.id,
    });
    const inChild = await createNote(db, { ownerId: owner, folderId: child.id, title: 'A' });
    const outside = await createNote(db, { ownerId: owner, title: 'B' });
    // Deleted separately earlier: undoing the folder delete must not bring it back.
    const earlier = await createNote(db, { ownerId: owner, folderId: parent.id, title: 'C' });
    await deleteNote(db, earlier.id, at(minutes(1)));

    const deleted = await deleteFolder(db, parent.id, at(minutes(2)));
    expect((await getNote(db, inChild.id))?.deletedAt).toBe(minutes(2));
    expect((await getNote(db, outside.id))?.deletedAt).toBeNull();

    await restoreFolders(db, deleted, at(minutes(3)));
    expect((await getNote(db, inChild.id))?.deletedAt).toBeNull();
    expect((await getNote(db, earlier.id))?.deletedAt).toBe(minutes(1));
  });
});
