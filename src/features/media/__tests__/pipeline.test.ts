import type { MediaFileStore } from '../files';
import { addImage, cleanUpIfDue, LAST_CLEANUP_KEY, type PipelineDeps } from '../pipeline';
import { getMedia } from '../repo';
import { getProfile } from '@/features/profile/repo';
import { getSetting, setSetting } from '@/features/settings/repo';
import { getLogLevel, setLogLevel } from '@/lib/logger';
import { createTestDatabase } from '@/test-utils/db';

// Keep the "Saved image" info logs out of the test output.
const logLevel = getLogLevel();
beforeAll(() => setLogLevel('warn'));
afterAll(() => setLogLevel(logLevel));

const NOW = new Date('2026-10-09T12:00:00.000Z');
const clock = () => NOW;

/** An in-memory media folder. */
function fakeFiles(initial: Record<string, { bytes: number; modifiedMs: number }> = {}) {
  const sizes = new Map<string, number>([['file:///cache/original.jpg', 4_000_000]]);
  const stored = new Map(Object.entries(initial));
  const store: MediaFileStore = {
    adopt(sourceUri, id) {
      const name = `${id}.jpg`;
      stored.set(name, { bytes: sizes.get(sourceUri) ?? 0, modifiedMs: NOW.getTime() });
      sizes.delete(sourceUri);
      return { relativePath: `media/${name}`, bytes: stored.get(name)!.bytes };
    },
    sizeOf: (uri) => sizes.get(uri) ?? null,
    resolve: (path) => (stored.has(path.replace('media/', '')) ? `file:///docs/${path}` : null),
    list: () => [...stored].map(([name, f]) => ({ name, modifiedMs: f.modifiedMs })),
    remove: (name) => void stored.delete(name),
  };
  return { store, stored, sizes };
}

function deps(files: MediaFileStore, overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    pick: async () => ({ uri: 'file:///cache/original.jpg', width: 4000, height: 3000 }),
    compress: async (image) => {
      expect(image.uri).toBe('file:///cache/original.jpg');
      return { uri: 'file:///cache/compressed.jpg', width: 1600, height: 1200 };
    },
    files,
    newId: () => 'media-1',
    clock,
    ...overrides,
  };
}

describe('addImage', () => {
  it('compresses, stores the file and records a media row owned by the profile', async () => {
    const db = createTestDatabase();
    const { store, sizes, stored } = fakeFiles();
    sizes.set('file:///cache/compressed.jpg', 280_000);

    const result = await addImage(db, 'library', deps(store));

    expect(result).toMatchObject({ status: 'saved', beforeBytes: 4_000_000, afterBytes: 280_000 });
    const profile = await getProfile(db);
    expect(await getMedia(db, 'media-1')).toMatchObject({
      ownerId: profile!.id,
      localUri: 'media/media-1.jpg',
      mime: 'image/jpeg',
      width: 1600,
      height: 1200,
      bytes: 280_000,
      uploadStatus: 'local',
      createdAt: NOW.toISOString(),
    });
    expect(stored.has('media-1.jpg')).toBe(true);
  });

  it('prefers the size the picker reports', async () => {
    const db = createTestDatabase();
    const { store } = fakeFiles();
    const result = await addImage(
      db,
      'camera',
      deps(store, {
        pick: async () => ({
          uri: 'file:///cache/original.jpg',
          width: 4000,
          height: 3000,
          bytes: 5_000_000,
        }),
      }),
    );
    expect(result).toMatchObject({ status: 'saved', beforeBytes: 5_000_000 });
  });

  it('does nothing when the student cancels or denies the camera', async () => {
    const db = createTestDatabase();
    const { store, stored } = fakeFiles();
    const compress = jest.fn();

    expect(
      await addImage(db, 'library', deps(store, { pick: async () => null, compress })),
    ).toEqual({ status: 'cancelled' });
    expect(
      await addImage(
        db,
        'camera',
        deps(store, { pick: async () => 'permission-denied', compress }),
      ),
    ).toEqual({ status: 'permission-denied' });
    expect(compress).not.toHaveBeenCalled();
    expect(stored.size).toBe(0);
  });
});

describe('cleanUpIfDue', () => {
  const old = NOW.getTime() - 2 * 60 * 60 * 1000;

  it('deletes orphan files, keeps referenced ones and remembers when it ran', async () => {
    const db = createTestDatabase();
    const { store, stored } = fakeFiles({
      'orphan.jpg': { bytes: 10, modifiedMs: old },
    });
    stored.set('media-1.jpg', { bytes: 10, modifiedMs: old });
    // Save a real row for media-1 first.
    await addImage(db, 'library', deps(store));

    expect(await cleanUpIfDue(db, { files: store, clock })).toBe(1);
    expect([...stored.keys()]).toEqual(['media-1.jpg']);
    expect(await getSetting(db, LAST_CLEANUP_KEY)).toBe(NOW.toISOString());
  });

  it('skips when it already ran this week', async () => {
    const db = createTestDatabase();
    const { store, stored } = fakeFiles({ 'orphan.jpg': { bytes: 10, modifiedMs: old } });
    await setSetting(db, LAST_CLEANUP_KEY, '2026-10-06T12:00:00.000Z');

    expect(await cleanUpIfDue(db, { files: store, clock })).toBeNull();
    expect(stored.has('orphan.jpg')).toBe(true);
  });
});
