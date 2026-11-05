import { eq } from 'drizzle-orm';

import { achievements, decks, notes, profiles, xpEvents } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { ensureProfile } from '@/features/profile/repo';
import { createTestDatabase } from '@/test-utils/db';
import { createFakeServer } from '@/test-utils/fakeSyncServer';

import { runSync } from '../engine';
import { getLastSyncedAt } from '../repo';

const USER = '00000000-0000-4000-a000-00000000000a';
let tick = Date.parse('2026-11-05T10:00:00.000Z');
const now = () => new Date((tick += 1000)).toISOString();

async function phone(): Promise<AppDatabase> {
  const db = createTestDatabase();
  // After sign-in (task 3.2) the profile id is the account id.
  await ensureProfile(db, { newId: () => USER, now: () => '2026-11-05T09:00:00.000Z' });
  return db;
}

function addNote(db: AppDatabase, id: string, title: string) {
  const at = now();
  db.insert(notes)
    .values({
      id,
      ownerId: USER,
      createdAt: at,
      updatedAt: at,
      title,
      contentJson: '{"type":"doc"}',
    })
    .run();
}

function editNote(db: AppDatabase, id: string, changes: Partial<typeof notes.$inferInsert>) {
  db.update(notes)
    .set({ ...changes, updatedAt: now(), dirty: true })
    .where(eq(notes.id, id))
    .run();
}

const note = (db: AppDatabase, id: string) => db.select().from(notes).where(eq(notes.id, id)).get();

describe('runSync', () => {
  it('uploads a phone’s study and marks it uploaded', async () => {
    const server = createFakeServer();
    const a = await phone();
    addNote(a, 'n1', 'SAMPLE note');
    db_insertDeck(a, 'd1');

    const summary = await runSync(a, server.transport, USER, { now });

    expect(summary.pushed).toBe(2);
    expect(server.rows('notes')).toEqual([
      expect.objectContaining({ id: 'n1', owner_id: USER, content_json: { type: 'doc' } }),
    ]);
    expect(server.rows('decks')).toHaveLength(1);
    expect(note(a, 'n1')).toMatchObject({ dirty: false });
    expect(await getLastSyncedAt(a)).not.toBeNull();
    expect(server.profile(USER)).toMatchObject({ id: USER, daily_goal_xp: 50 });
  });

  it('brings everything to a second phone, not marked dirty', async () => {
    const server = createFakeServer();
    const a = await phone();
    addNote(a, 'n1', 'SAMPLE note');
    await runSync(a, server.transport, USER, { now });

    const b = await phone();
    const summary = await runSync(b, server.transport, USER, { now });

    expect(summary.pulled).toBeGreaterThanOrEqual(1);
    expect(note(b, 'n1')).toMatchObject({
      title: 'SAMPLE note',
      contentJson: '{"type":"doc"}',
      ownerId: USER,
      dirty: false,
    });
    // Nothing to send back.
    expect((await runSync(b, server.transport, USER, { now })).pushed).toBe(0);
  });

  it('makes two phones agree after offline edits (the newer edit wins)', async () => {
    const server = createFakeServer();
    const a = await phone();
    addNote(a, 'n1', 'first');
    addNote(a, 'n2', 'keep me');
    await runSync(a, server.transport, USER, { now });
    const b = await phone();
    await runSync(b, server.transport, USER, { now });

    // Both offline: A edits n1, then B edits n1 later and deletes n2.
    editNote(a, 'n1', { title: 'from A' });
    editNote(b, 'n1', { title: 'from B (newer)' });
    editNote(b, 'n2', { deletedAt: now() });

    // A syncs first, then B, then A again.
    await runSync(a, server.transport, USER, { now });
    await runSync(b, server.transport, USER, { now });
    await runSync(a, server.transport, USER, { now });

    for (const db of [a, b]) {
      expect(note(db, 'n1')).toMatchObject({ title: 'from B (newer)', dirty: false });
      expect(note(db, 'n2')?.deletedAt).not.toBeNull();
    }
  });

  it('keeps an older offline edit from overwriting a newer one already on the server', async () => {
    const server = createFakeServer();
    const a = await phone();
    addNote(a, 'n1', 'start');
    await runSync(a, server.transport, USER, { now });
    const b = await phone();
    await runSync(b, server.transport, USER, { now });

    editNote(a, 'n1', { title: 'older edit on A' });
    editNote(b, 'n1', { title: 'newer edit on B' });
    await runSync(b, server.transport, USER, { now });
    await runSync(a, server.transport, USER, { now });

    expect(server.rows('notes')[0]).toMatchObject({ title: 'newer edit on B' });
    expect(note(a, 'n1')).toMatchObject({ title: 'newer edit on B', dirty: false });
  });

  it('keeps one copy of a badge both phones unlocked offline', async () => {
    const server = createFakeServer();
    const a = await phone();
    const b = await phone();
    const at = now();
    const badge = {
      ownerId: USER,
      key: 'first_steps',
      createdAt: at,
      updatedAt: at,
      unlockedAt: at,
    };
    a.insert(achievements)
      .values({ id: 'badge-a', ...badge })
      .run();
    b.insert(achievements)
      .values({ id: 'badge-b', ...badge })
      .run();

    await runSync(a, server.transport, USER, { now });
    await runSync(b, server.transport, USER, { now });

    expect(b.select().from(achievements).all()).toHaveLength(1);
    expect(server.rows('achievements')).toHaveLength(2);
  });

  it('pulls more than one page', async () => {
    const server = createFakeServer();
    const a = await phone();
    const at = now();
    a.insert(xpEvents)
      .values(
        Array.from({ length: 650 }, (_, i) => ({
          id: `x${i}`,
          ownerId: USER,
          createdAt: at,
          updatedAt: at,
          studyDay: '2026-11-05',
          source: 'review_card' as const,
          amount: 1,
        })),
      )
      .run();
    expect((await runSync(a, server.transport, USER, { now })).pushed).toBe(650);

    const b = await phone();
    await runSync(b, server.transport, USER, { now });
    expect(b.select().from(xpEvents).all()).toHaveLength(650);
  });

  it('takes a newer profile from the server', async () => {
    const server = createFakeServer();
    const a = await phone();
    await runSync(a, server.transport, USER, { now });
    const b = await phone();
    b.update(profiles).set({ dailyGoalXp: 100, updatedAt: now() }).run();
    await runSync(b, server.transport, USER, { now });

    await runSync(a, server.transport, USER, { now });
    expect(a.select().from(profiles).get()?.dailyGoalXp).toBe(100);
  });

  it('stops on a network error and leaves the rows dirty for the next try', async () => {
    const server = createFakeServer();
    const a = await phone();
    addNote(a, 'n1', 'SAMPLE note');
    server.failNextUpsert(new TypeError('Network request failed'));

    await expect(runSync(a, server.transport, USER, { now })).rejects.toThrow('Network');
    expect(note(a, 'n1')?.dirty).toBe(true);

    await runSync(a, server.transport, USER, { now });
    expect(note(a, 'n1')?.dirty).toBe(false);
  });
});

function db_insertDeck(db: AppDatabase, id: string) {
  const at = now();
  db.insert(decks)
    .values({ id, ownerId: USER, createdAt: at, updatedAt: at, title: 'SAMPLE deck' })
    .run();
}
