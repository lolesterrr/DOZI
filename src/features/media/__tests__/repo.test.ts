import {
  deleteMedia,
  getMedia,
  insertMedia,
  listMedia,
  listMediaFileRefs,
  restoreMedia,
  storageUsedBytes,
} from '../repo';
import { createTestDatabase } from '@/test-utils/db';

const base = {
  ownerId: 'owner-1',
  mime: 'image/jpeg',
  width: 1600,
  height: 1200,
  uploadStatus: 'local' as const,
};

function at(time: string) {
  return { now: () => time };
}

describe('media repo', () => {
  it('inserts a row with sync defaults', async () => {
    const db = createTestDatabase();
    const row = await insertMedia(
      db,
      { ...base, id: 'm1', localUri: 'media/m1.jpg', bytes: 250_000 },
      at('2026-10-09T10:00:00.000Z'),
    );
    expect(row).toMatchObject({
      id: 'm1',
      localUri: 'media/m1.jpg',
      bytes: 250_000,
      uploadStatus: 'local',
      deletedAt: null,
      dirty: true,
      syncedAt: null,
      createdAt: '2026-10-09T10:00:00.000Z',
      updatedAt: '2026-10-09T10:00:00.000Z',
    });
    expect(await getMedia(db, 'm1')).toEqual(row);
  });

  it('lists newest first and sums storage, ignoring deleted and cloud-only images', async () => {
    const db = createTestDatabase();
    await insertMedia(
      db,
      { ...base, id: 'old', localUri: 'media/old.jpg', bytes: 100 },
      at('2026-10-01T00:00:00.000Z'),
    );
    await insertMedia(
      db,
      { ...base, id: 'new', localUri: 'media/new.jpg', bytes: 200 },
      at('2026-10-02T00:00:00.000Z'),
    );
    await insertMedia(
      db,
      { ...base, id: 'cloud', localUri: null, bytes: 999 },
      at('2026-10-03T00:00:00.000Z'),
    );
    await insertMedia(
      db,
      { ...base, id: 'gone', localUri: 'media/gone.jpg', bytes: 400 },
      at('2026-10-04T00:00:00.000Z'),
    );
    await deleteMedia(db, 'gone');

    expect((await listMedia(db)).map((m) => m.id)).toEqual(['cloud', 'new', 'old']);
    expect(await storageUsedBytes(db)).toBe(300);
  });

  it('is 0 bytes with no images', async () => {
    expect(await storageUsedBytes(createTestDatabase())).toBe(0);
  });

  it('soft-deletes and restores', async () => {
    const db = createTestDatabase();
    await insertMedia(db, { ...base, id: 'm1', localUri: 'media/m1.jpg', bytes: 1 });
    await deleteMedia(db, 'm1', at('2026-10-09T11:00:00.000Z'));
    expect(await getMedia(db, 'm1')).toMatchObject({
      deletedAt: '2026-10-09T11:00:00.000Z',
      updatedAt: '2026-10-09T11:00:00.000Z',
    });
    expect(await listMediaFileRefs(db)).toEqual([
      { localUri: 'media/m1.jpg', deletedAt: '2026-10-09T11:00:00.000Z' },
    ]);

    await restoreMedia(db, 'm1', at('2026-10-09T11:01:00.000Z'));
    expect(await getMedia(db, 'm1')).toMatchObject({
      deletedAt: null,
      updatedAt: '2026-10-09T11:01:00.000Z',
    });
  });
});
