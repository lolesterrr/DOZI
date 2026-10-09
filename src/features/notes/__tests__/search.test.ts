import { createTestDatabase } from '@/test-utils/db';

import { MATCH_END, MATCH_START, splitHighlights, toFtsQuery, type DocNode } from '../logic';
import {
  addSampleNotes,
  createNote,
  deleteNote,
  listNotes,
  removeSampleNotes,
  saveNoteContent,
  searchNotes,
  setNoteTitle,
} from '../repo';

// SAMPLE content for tests only — not reviewed pharmacology.
const owner = 'owner-1';
const doc = (...lines: string[]): DocNode => ({
  type: 'doc',
  content: lines.map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] })),
});
const plain = (marked: string) =>
  marked.replace(new RegExp(`[${MATCH_START}${MATCH_END}]`, 'g'), '');

describe('search queries', () => {
  it('quotes every word and matches word starts', () => {
    expect(toFtsQuery('  Beta blockers ')).toBe('"beta"* "blockers"*');
    expect(toFtsQuery('beta-blocker')).toBe('"beta"* "blocker"*');
  });

  it('never passes search operators or quotes through', () => {
    expect(toFtsQuery('"a" OR b* NEAR(c)')).toBe('"a"* "or"* "b"* "near"* "c"*');
    expect(toFtsQuery('***  "" ()')).toBeNull();
    expect(toFtsQuery('')).toBeNull();
  });

  it('keeps accents and other alphabets, drops repeats', () => {
    expect(toFtsQuery('Café café naïve')).toBe('"café"* "naïve"*');
  });

  it('splits marked text into plain and matching parts', () => {
    expect(splitHighlights(`a ${MATCH_START}beta${MATCH_END} b\nc`)).toEqual([
      { text: 'a ', match: false },
      { text: 'beta', match: true },
      { text: ' b c', match: false },
    ]);
    expect(splitHighlights('no match')).toEqual([{ text: 'no match', match: false }]);
  });
});

describe('searchNotes', () => {
  it('finds a word inside a note body, with a highlighted snippet', async () => {
    const db = createTestDatabase();
    const note = await createNote(db, {
      ownerId: owner,
      title: 'Week 3',
      content: doc('SAMPLE', 'The receptor diagram from the board'),
    });
    const [result] = await searchNotes(db, owner, 'recep');
    expect(result.id).toBe(note.id);
    expect(result.snippet).toContain(`${MATCH_START}receptor${MATCH_END}`);
    expect(plain(result.title)).toBe('Week 3');
  });

  it('needs every word, ignores case and accents', async () => {
    const db = createTestDatabase();
    await createNote(db, { ownerId: owner, title: 'One', content: doc('alpha beta') });
    await createNote(db, { ownerId: owner, title: 'Two', content: doc('alpha gamma') });
    expect((await searchNotes(db, owner, 'ALPHA beta')).map((r) => plain(r.title))).toEqual([
      'One',
    ]);
    await createNote(db, { ownerId: owner, title: 'Café', content: doc('') });
    expect((await searchNotes(db, owner, 'cafe')).map((r) => plain(r.title))).toEqual(['Café']);
  });

  it('ranks a title match above a body match', async () => {
    const db = createTestDatabase();
    await createNote(db, {
      ownerId: owner,
      title: 'Revision',
      content: doc('kidney kidney kidney'),
    });
    await createNote(db, { ownerId: owner, title: 'Kidney', content: doc('other words here') });
    const results = await searchNotes(db, owner, 'kidney');
    expect(results.map((r) => plain(r.title))).toEqual(['Kidney', 'Revision']);
    // Only the title matched, so there's no snippet to show.
    expect(results[0].snippet).toBe('');
  });

  it('follows edits, and leaves out deleted notes and other people’s notes', async () => {
    const db = createTestDatabase();
    const note = await createNote(db, { ownerId: owner, title: 'Old', content: doc('first') });
    await createNote(db, { ownerId: 'someone-else', title: 'Old', content: doc('first') });

    await saveNoteContent(db, note.id, doc('second'));
    await setNoteTitle(db, note.id, 'New');
    expect(await searchNotes(db, owner, 'first')).toEqual([]);
    expect(await searchNotes(db, owner, 'old')).toEqual([]);
    expect(await searchNotes(db, owner, 'second new')).toHaveLength(1);

    await deleteNote(db, note.id);
    expect(await searchNotes(db, owner, 'second')).toEqual([]);
  });

  it('copes with text that looks like search syntax', async () => {
    const db = createTestDatabase();
    await createNote(db, { ownerId: owner, title: 'Plain', content: doc('a "quoted" word') });
    await expect(searchNotes(db, owner, '"quoted')).resolves.toHaveLength(1);
    await expect(searchNotes(db, owner, 'AND OR NOT')).resolves.toEqual([]);
    await expect(searchNotes(db, owner, '   ')).resolves.toEqual([]);
  });
});

describe('search speed with 500 SAMPLE notes (task 1.4 "done when")', () => {
  it('finds a word inside a note body in under 200 ms', async () => {
    const db = createTestDatabase();
    await addSampleNotes(db, owner, 500);
    const target = await createNote(db, {
      ownerId: owner,
      title: 'Lecture',
      content: doc('SAMPLE', 'somewhere in the middle is the word zebrafish today'),
    });
    expect(await listNotes(db, owner)).toHaveLength(501);

    for (const word of ['zebrafish', 'seminar', 'revision note']) {
      const started = performance.now();
      const results = await searchNotes(db, owner, word);
      const ms = performance.now() - started;
      expect(results.length).toBeGreaterThan(0);
      expect(ms).toBeLessThan(200);
    }
    expect((await searchNotes(db, owner, 'zebrafish'))[0].id).toBe(target.id);

    expect(await removeSampleNotes(db, owner)).toBe(500);
    expect(await listNotes(db, owner)).toHaveLength(1);
    expect(await searchNotes(db, owner, 'seminar')).toEqual([]);
  });

  it('keeps saving fast with 500 notes indexed', async () => {
    const db = createTestDatabase();
    await addSampleNotes(db, owner, 500);
    const note = await createNote(db, { ownerId: owner });
    const started = performance.now();
    for (let i = 0; i < 20; i++) await saveNoteContent(db, note.id, doc(`edit ${i}`));
    expect((performance.now() - started) / 20).toBeLessThan(20);
  });
});
