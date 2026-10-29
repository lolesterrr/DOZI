import { eq } from 'drizzle-orm';

import { notes } from '@/db/schema';
import { createNote, deleteNote } from '@/features/notes/repo';
import { createTestDatabase } from '@/test-utils/db';

import { checkAchievements, getAchievementEntries } from '../achievementsRepo';
import { awardXp } from '../repo';

const owner = 'owner-1';
const NOW = '2026-10-29T10:00:00.000Z';

async function tenNotes(db: ReturnType<typeof createTestDatabase>) {
  const made = [];
  for (let i = 0; i < 10; i++) made.push(await createNote(db, { ownerId: owner, title: `n${i}` }));
  return made;
}

describe('checkAchievements', () => {
  it('unlocks nothing at the start', async () => {
    const db = createTestDatabase();
    expect(await checkAchievements(db, owner, { now: NOW })).toEqual([]);
  });

  it('unlocks Note Taker at 10 notes, once', async () => {
    const db = createTestDatabase();
    const made = await tenNotes(db);
    expect(made).toHaveLength(10);
    expect(await checkAchievements(db, owner, { now: NOW })).toEqual(['note_taker']);
    expect(await checkAchievements(db, owner, { now: NOW })).toEqual([]);
  });

  it('keeps a badge after the notes are deleted', async () => {
    const db = createTestDatabase();
    const made = await tenNotes(db);
    await checkAchievements(db, owner, { now: NOW });
    for (const note of made) await deleteNote(db, note.id);
    const stillThere = await db.select().from(notes).where(eq(notes.ownerId, owner));
    expect(stillThere.length).toBe(10);
    const entries = await getAchievementEntries(db, owner);
    expect(entries[0]).toMatchObject({ key: 'note_taker', unlockedAt: NOW, met: true });
  });

  it('counts XP-based badges and the streak', async () => {
    const db = createTestDatabase();
    await awardXp(db, { ownerId: owner, source: 'mock_exam', sourceId: 'm1' }, { now: () => NOW });
    expect(await checkAchievements(db, owner, { now: NOW })).toEqual(['mock_survivor']);
  });
});

describe('getAchievementEntries', () => {
  it('lists every badge, earned first, with progress on the locked ones', async () => {
    const db = createTestDatabase();
    await createNote(db, { ownerId: owner });
    const entries = await getAchievementEntries(db, owner);
    expect(entries).toHaveLength(15);
    const taker = entries.find((e) => e.key === 'note_taker');
    expect(taker).toMatchObject({ value: 1, target: 10, unlockedAt: null });
  });
});
