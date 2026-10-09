import { deleteSetting, getSetting, setSetting } from '../repo';
import { settings } from '@/db/schema';
import { createTestDatabase } from '@/test-utils/db';

describe('settings repo', () => {
  it('returns undefined for a setting that was never saved', async () => {
    const db = createTestDatabase();
    expect(await getSetting(db, 'theme')).toBeUndefined();
  });

  it('round-trips JSON values', async () => {
    const db = createTestDatabase();
    await setSetting(db, 'theme', 'dark');
    await setSetting(db, 'sync.cursor', { notes: '2026-10-09T18:00:00.000Z', page: 2 });
    await setSetting(db, 'wifiOnly', false);

    expect(await getSetting(db, 'theme')).toBe('dark');
    expect(await getSetting(db, 'sync.cursor')).toEqual({
      notes: '2026-10-09T18:00:00.000Z',
      page: 2,
    });
    expect(await getSetting(db, 'wifiOnly')).toBe(false);
  });

  it('replaces an earlier value instead of adding a second row', async () => {
    const db = createTestDatabase();
    await setSetting(db, 'theme', 'dark');
    await setSetting(db, 'theme', 'light');

    expect(await getSetting(db, 'theme')).toBe('light');
    expect(await db.select().from(settings)).toHaveLength(1);
  });

  it('deletes a setting', async () => {
    const db = createTestDatabase();
    await setSetting(db, 'theme', 'dark');
    await deleteSetting(db, 'theme');
    expect(await getSetting(db, 'theme')).toBeUndefined();
  });

  it('treats a corrupt stored value as missing', async () => {
    const db = createTestDatabase();
    await db.insert(settings).values({ key: 'theme', valueJson: '{not json' });
    expect(await getSetting(db, 'theme')).toBeUndefined();
  });

  it('refuses values that are not JSON', async () => {
    const db = createTestDatabase();
    await expect(setSetting(db, 'bad', undefined)).rejects.toThrow('can’t be saved');
  });
});
