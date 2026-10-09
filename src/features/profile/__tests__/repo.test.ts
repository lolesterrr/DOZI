import { ensureProfile, getProfile, updateProfile } from '../repo';
import { profiles } from '@/db/schema';
import { createTestDatabase } from '@/test-utils/db';

const ids = (...values: string[]) => {
  const queue = [...values];
  return () => queue.shift() ?? 'unexpected-extra-id';
};

describe('profile repo', () => {
  it('has no profile before the first launch', async () => {
    const db = createTestDatabase();
    expect(await getProfile(db)).toBeUndefined();
  });

  it('creates a profile with the documented defaults on first launch', async () => {
    const db = createTestDatabase();
    const profile = await ensureProfile(db, {
      newId: ids('profile-1'),
      now: () => '2026-10-09T18:00:00.000Z',
    });

    expect(profile).toMatchObject({
      id: 'profile-1',
      timezone: 'Africa/Kampala',
      dailyGoalXp: 50,
      role: 'student',
      displayName: null,
      authUserId: null,
      createdAt: '2026-10-09T18:00:00.000Z',
      updatedAt: '2026-10-09T18:00:00.000Z',
    });
    expect(await getProfile(db)).toEqual(profile);
  });

  it('keeps the same profile on later launches', async () => {
    const db = createTestDatabase();
    const first = await ensureProfile(db, { newId: ids('profile-1') });
    const second = await ensureProfile(db, { newId: ids('profile-2') });

    expect(second.id).toBe(first.id);
    expect(await db.select().from(profiles)).toHaveLength(1);
  });

  it('uses a UUID when no id generator is given', async () => {
    const db = createTestDatabase();
    const profile = await ensureProfile(db);
    expect(profile.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('updates fields and bumps updated_at only', async () => {
    const db = createTestDatabase();
    const created = await ensureProfile(db, {
      newId: ids('profile-1'),
      now: () => '2026-10-09T18:00:00.000Z',
    });

    const updated = await updateProfile(
      db,
      created.id,
      { displayName: 'Joe', yearOfStudy: 2, dailyGoalXp: 100 },
      { now: () => '2026-10-10T07:30:00.000Z' },
    );

    expect(updated).toMatchObject({
      displayName: 'Joe',
      yearOfStudy: 2,
      dailyGoalXp: 100,
      createdAt: '2026-10-09T18:00:00.000Z',
      updatedAt: '2026-10-10T07:30:00.000Z',
    });
  });

  it('returns undefined when updating a profile that does not exist', async () => {
    const db = createTestDatabase();
    expect(await updateProfile(db, 'missing', { displayName: 'X' })).toBeUndefined();
  });
});
