import { eq } from 'drizzle-orm';

import { adoptLocalData, countUnsyncedChanges } from '../repo';
import { decks, notes, profiles, questions, streakState, xpEvents } from '@/db/schema';
import { ensureProfile } from '@/features/profile/repo';
import { createTestDatabase } from '@/test-utils/db';

const T = '2026-11-03T10:00:00.000Z';

async function phoneWithStudy() {
  const db = createTestDatabase();
  await ensureProfile(db, { newId: () => 'device-1', now: () => T });
  const owned = { ownerId: 'device-1', createdAt: T, updatedAt: T };
  db.insert(notes)
    .values({ id: 'n1', ...owned, contentJson: '{}', dirty: false })
    .run();
  db.insert(decks)
    .values({ id: 'd1', ...owned, title: 'SAMPLE deck' })
    .run();
  db.insert(xpEvents)
    .values({ id: 'x1', ...owned, studyDay: '2026-11-03', source: 'note_created', amount: 5 })
    .run();
  db.insert(streakState)
    .values({ ...owned, current: 2 })
    .run();
  // A row that isn't the student's (an official question, Phase 4) must be left alone.
  db.insert(questions)
    .values({
      id: 'q-official',
      ownerId: null,
      createdAt: T,
      updatedAt: T,
      source: 'official',
      type: 'sba',
      stemJson: '{}',
      payloadJson: '{}',
      dirty: false,
    })
    .run();
  return db;
}

describe('adoptLocalData', () => {
  it('gives every row and the profile the account id and marks rows for upload', async () => {
    const db = await phoneWithStudy();
    const result = await adoptLocalData(db, 'user-a', { now: () => '2026-11-03T11:00:00.000Z' });

    expect(result).toEqual({ decision: 'adopt', rowsAdopted: 4 });
    const [profile] = db.select().from(profiles).all();
    expect(profile).toMatchObject({
      id: 'user-a',
      authUserId: 'user-a',
      updatedAt: '2026-11-03T11:00:00.000Z',
    });
    const note = db.select().from(notes).where(eq(notes.id, 'n1')).get();
    expect(note).toMatchObject({ ownerId: 'user-a', dirty: true, updatedAt: T });
    expect(db.select().from(decks).get()?.ownerId).toBe('user-a');
    expect(db.select().from(xpEvents).get()?.ownerId).toBe('user-a');
    expect(db.select().from(streakState).get()).toMatchObject({ ownerId: 'user-a', current: 2 });
    expect(db.select().from(questions).get()).toMatchObject({ ownerId: null, dirty: false });
  });

  it('does nothing the second time', async () => {
    const db = await phoneWithStudy();
    await adoptLocalData(db, 'user-a');
    expect(await adoptLocalData(db, 'user-a')).toEqual({
      decision: 'already-adopted',
      rowsAdopted: 0,
    });
  });

  it('refuses another account and leaves the study untouched', async () => {
    const db = await phoneWithStudy();
    await adoptLocalData(db, 'user-a');
    expect(await adoptLocalData(db, 'user-b')).toEqual({
      decision: 'other-account',
      rowsAdopted: 0,
    });
    expect(db.select().from(profiles).get()?.id).toBe('user-a');
    expect(db.select().from(notes).get()?.ownerId).toBe('user-a');
  });
});

describe('countUnsyncedChanges', () => {
  it('counts the student’s rows that still need uploading', async () => {
    const db = await phoneWithStudy();
    // n1 was saved clean; d1, x1 and the streak are dirty.
    expect(await countUnsyncedChanges(db, 'device-1')).toBe(3);
    await adoptLocalData(db, 'user-a');
    expect(await countUnsyncedChanges(db, 'user-a')).toBe(4);
    expect(await countUnsyncedChanges(db, 'device-1')).toBe(0);
  });
});
