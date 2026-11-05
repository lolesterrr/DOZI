import { eq } from 'drizzle-orm';

import { adoptLocalData, countUnsyncedChanges, forgetAccount } from '../repo';
import { decks, media, notes, profiles, questions, streakState, xpEvents } from '@/db/schema';
import { ensureProfile } from '@/features/profile/repo';
import { getSetting, setSetting } from '@/features/settings/repo';
import { createTestDatabase } from '@/test-utils/db';

const T = '2026-11-03T10:00:00.000Z';
const USER_A = '00000000-0000-4000-a000-00000000000a';
const USER_B = '00000000-0000-4000-a000-00000000000b';

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

describe('forgetAccount', () => {
  it('keeps the study, unlinks the account and lets a new account adopt it later', async () => {
    const db = await phoneWithStudy();
    await adoptLocalData(db, USER_A, { now: () => T });
    db.update(notes).set({ dirty: false }).run();
    db.insert(media)
      .values({
        id: 'm1',
        ownerId: USER_A,
        createdAt: T,
        updatedAt: T,
        localUri: 'media/m1.jpg',
        remotePath: `${USER_A}/m1.jpg`,
        uploadStatus: 'uploaded',
        mime: 'image/jpeg',
        width: 1,
        height: 1,
        bytes: 1,
        dirty: false,
      })
      .run();
    await setSetting(db, 'sync.cursor.notes', '2026-11-03T10:00:00.000000+00:00');
    await setSetting(db, 'sync.lastSyncedAt', T);
    await setSetting(db, 'wifiOnly', false);

    await forgetAccount(db);

    expect(db.select().from(notes).get()).toMatchObject({ id: 'n1', dirty: true });
    // The picture keeps its cloud copy: signing back in within the 10 days keeps the account.
    expect(db.select().from(media).get()).toMatchObject({
      localUri: 'media/m1.jpg',
      remotePath: `${USER_A}/m1.jpg`,
      dirty: true,
    });
    expect(db.select().from(profiles).get()).toMatchObject({ id: USER_A, authUserId: null });
    expect(await getSetting(db, 'sync.cursor.notes')).toBeUndefined();
    expect(await getSetting(db, 'sync.lastSyncedAt')).toBeUndefined();
    expect(await getSetting(db, 'wifiOnly')).toBe(false);
    // Official content is left alone.
    expect(db.select().from(questions).where(eq(questions.id, 'q-official')).get()).toMatchObject({
      dirty: false,
    });

    // A different account can now take the study over; its pictures are uploaded again.
    expect((await adoptLocalData(db, USER_B, { now: () => T })).decision).toBe('adopt');
    expect(db.select().from(notes).get()).toMatchObject({ ownerId: USER_B });
    expect(db.select().from(media).get()).toMatchObject({
      ownerId: USER_B,
      remotePath: null,
      uploadStatus: 'local',
    });
  });

  it('links the account again when the same student signs back in to keep it', async () => {
    const db = await phoneWithStudy();
    await adoptLocalData(db, USER_A, { now: () => T });
    await forgetAccount(db);

    expect((await adoptLocalData(db, USER_A, { now: () => T })).decision).toBe('already-adopted');
    expect(db.select().from(profiles).get()).toMatchObject({ id: USER_A, authUserId: USER_A });
    expect(db.select().from(notes).get()).toMatchObject({ ownerId: USER_A, dirty: true });
  });
});
