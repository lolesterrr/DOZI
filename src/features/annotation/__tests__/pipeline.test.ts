import type { Media } from '@/db/schema';
import type { MediaFileStore } from '@/features/media/files';
import { getMedia, insertMedia } from '@/features/media/repo';
import { ensureProfile } from '@/features/profile/repo';
import { getLogLevel, setLogLevel } from '@/lib/logger';
import { createTestDatabase } from '@/test-utils/db';

import { emptyAnnotation, parseAnnotation, type Annotation } from '../logic';
import { loadAnnotationStart, saveAnnotatedImage, type RenderAnnotation } from '../pipeline';

// Keep the "Saved annotated image" info logs out of the test output.
const logLevel = getLogLevel();
beforeAll(() => setLogLevel('warn'));
afterAll(() => setLogLevel(logLevel));

const NOW = new Date('2026-10-09T12:00:00.000Z');

function fakeFiles() {
  const stored = new Map<string, number>();
  const store: MediaFileStore = {
    adopt(sourceUri, id) {
      expect(sourceUri).toBe('file:///cache/annotated.jpg');
      stored.set(`${id}.jpg`, 300_000);
      return { relativePath: `media/${id}.jpg`, bytes: 300_000 };
    },
    sizeOf: () => null,
    resolve: (path) => `file:///docs/${path}`,
    list: () => [],
    remove: () => {},
  };
  return { store, stored };
}

async function addOriginal(db: ReturnType<typeof createTestDatabase>): Promise<Media> {
  const profile = await ensureProfile(db);
  return insertMedia(db, {
    id: 'original',
    ownerId: profile.id,
    localUri: 'media/original.jpg',
    mime: 'image/jpeg',
    width: 1600,
    height: 1200,
    bytes: 250_000,
  });
}

const drawing: Annotation = {
  ...emptyAnnotation(1600, 1200),
  shapes: [
    { kind: 'arrow', colour: 'red', from: { x: 10, y: 10 }, to: { x: 300, y: 200 } },
    { kind: 'text', colour: 'yellow', at: { x: 400, y: 300 }, text: 'SAMPLE label' },
  ],
};

const render: RenderAnnotation = async (base, annotation) => {
  expect(base.id).toBe('original');
  return { uri: 'file:///cache/annotated.jpg', width: annotation.width, height: annotation.height };
};

describe('saveAnnotatedImage', () => {
  it('saves a new image derived from the original and leaves the original alone', async () => {
    const db = createTestDatabase();
    const original = await addOriginal(db);
    const { store, stored } = fakeFiles();

    const saved = await saveAnnotatedImage(db, original, drawing, {
      render,
      files: store,
      newId: () => 'annotated',
      clock: () => NOW,
    });

    expect(saved).toMatchObject({
      id: 'annotated',
      ownerId: original.ownerId,
      localUri: 'media/annotated.jpg',
      width: 1600,
      height: 1200,
      bytes: 300_000,
      derivedFrom: 'original',
      createdAt: NOW.toISOString(),
    });
    expect(parseAnnotation(saved.annotationJson)).toEqual(drawing);
    expect(stored.has('annotated.jpg')).toBe(true);
    expect(await getMedia(db, 'original')).toEqual(original);
  });

  it('saves nothing when drawing the picture fails', async () => {
    const db = createTestDatabase();
    const original = await addOriginal(db);
    const { store, stored } = fakeFiles();
    const failing: RenderAnnotation = async () => {
      throw new Error('out of memory');
    };

    await expect(
      saveAnnotatedImage(db, original, drawing, {
        render: failing,
        files: store,
        newId: () => 'x',
      }),
    ).rejects.toThrow('out of memory');
    expect(await getMedia(db, 'x')).toBeUndefined();
    expect(stored.size).toBe(0);
  });
});

describe('loadAnnotationStart', () => {
  it('starts a blank drawing over a plain image', async () => {
    const db = createTestDatabase();
    const original = await addOriginal(db);
    expect(await loadAnnotationStart(db, 'original')).toEqual({
      base: original,
      annotation: emptyAnnotation(1600, 1200),
    });
  });

  it('re-opens an annotated copy on its original, with the old strokes', async () => {
    const db = createTestDatabase();
    const original = await addOriginal(db);
    await saveAnnotatedImage(db, original, drawing, {
      render,
      files: fakeFiles().store,
      newId: () => 'annotated',
    });

    const start = await loadAnnotationStart(db, 'annotated');
    expect(start?.base.id).toBe('original');
    expect(start?.annotation).toEqual(drawing);
  });

  it('falls back to the copy itself when its original has gone from this phone', async () => {
    const db = createTestDatabase();
    const profile = await ensureProfile(db);
    const copy = await insertMedia(db, {
      id: 'copy',
      ownerId: profile.id,
      localUri: 'media/copy.jpg',
      mime: 'image/jpeg',
      width: 800,
      height: 600,
      bytes: 1,
      derivedFrom: 'gone',
      annotationJson: JSON.stringify(drawing),
    });
    expect(await loadAnnotationStart(db, 'copy')).toEqual({
      base: copy,
      annotation: emptyAnnotation(800, 600),
    });
  });

  it('returns null for an unknown image or one only in the cloud', async () => {
    const db = createTestDatabase();
    const profile = await ensureProfile(db);
    await insertMedia(db, {
      id: 'cloud',
      ownerId: profile.id,
      localUri: null,
      mime: 'image/jpeg',
      width: 1,
      height: 1,
      bytes: 1,
    });
    expect(await loadAnnotationStart(db, 'nope')).toBeNull();
    expect(await loadAnnotationStart(db, 'cloud')).toBeNull();
  });
});
