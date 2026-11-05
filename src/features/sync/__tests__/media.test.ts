import type { AppDatabase } from '@/db/types';
import { getMedia, insertMedia } from '@/features/media/repo';
import {
  downloadCloudMedia,
  downloadMedia,
  getDownloadState,
  resetDownloadsForTests,
  uploadPendingMedia,
  type MediaCloud,
  type MediaTransferDeps,
} from '@/features/media/transfer';
import { ensureProfile } from '@/features/profile/repo';
import { getLogLevel, setLogLevel } from '@/lib/logger';
import { createTestDatabase } from '@/test-utils/db';
import { createFakeServer } from '@/test-utils/fakeSyncServer';

import { runSync } from '../engine';

// Task 3.5: pictures added on one phone appear on another.

const USER = '00000000-0000-4000-a000-00000000000a';
let tick = Date.parse('2026-11-05T10:00:00.000Z');
const now = () => new Date((tick += 1000)).toISOString();

const logLevel = getLogLevel();
beforeAll(() => setLogLevel('error'));
afterAll(() => setLogLevel(logLevel));
afterEach(() => resetDownloadsForTests());

/** The Storage bucket, in memory: path → file contents. */
function fakeBucket() {
  const files = new Map<string, string>();
  return { files, failNext: null as Error | null };
}

/** One phone: its database, its media folder (relative path → contents) and its cloud helpers. */
async function phone(bucket: ReturnType<typeof fakeBucket>, connection = { allowed: true }) {
  const db = createTestDatabase();
  await ensureProfile(db, { newId: () => USER, now: () => '2026-10-01T09:00:00.000Z' });
  const folder = new Map<string, string>();
  const cloud: MediaCloud = {
    async upload(remotePath, fileUri) {
      if (bucket.failNext) {
        const error = bucket.failNext;
        bucket.failNext = null;
        throw error;
      }
      const contents = folder.get(fileUri.replace('file:///docs/', ''));
      if (contents === undefined) throw new Error('no such file');
      bucket.files.set(remotePath, contents);
    },
    async download(remotePath, id) {
      const contents = bucket.files.get(remotePath);
      if (contents === undefined) throw new Error('Object not found');
      folder.set(`media/${id}.jpg`, contents);
      return `media/${id}.jpg`;
    },
  };
  const deps: MediaTransferDeps = {
    cloud,
    resolve: (path) => (folder.has(path) ? `file:///docs/${path}` : null),
    networkAllowed: async () => connection.allowed,
    now,
  };
  return { db, folder, deps, connection };
}

async function addPicture(p: { db: AppDatabase; folder: Map<string, string> }, id: string) {
  p.folder.set(`media/${id}.jpg`, `SAMPLE picture ${id}`);
  await insertMedia(
    p.db,
    {
      id,
      ownerId: USER,
      localUri: `media/${id}.jpg`,
      mime: 'image/jpeg',
      width: 1600,
      height: 1200,
      bytes: 250_000,
    },
    { now },
  );
}

describe('picture sync', () => {
  it('shows a picture added on one phone on the other', async () => {
    const server = createFakeServer();
    const bucket = fakeBucket();
    const a = await phone(bucket);
    await addPicture(a, 'm1');

    const summary = await runSync(a.db, server.transport, USER, { now, media: a.deps });

    expect(summary.media).toEqual({ uploaded: 1, failed: 0, waiting: 0 });
    expect(bucket.files.get(`${USER}/m1.jpg`)).toBe('SAMPLE picture m1');
    // The row went up with its cloud path, in the same run.
    expect(server.rows('media')).toEqual([
      expect.objectContaining({ id: 'm1', remote_path: `${USER}/m1.jpg` }),
    ]);
    expect(await getMedia(a.db, 'm1')).toMatchObject({ uploadStatus: 'uploaded', dirty: false });

    const b = await phone(bucket);
    await runSync(b.db, server.transport, USER, { now, media: b.deps });
    expect(await getMedia(b.db, 'm1')).toMatchObject({
      remotePath: `${USER}/m1.jpg`,
      localUri: null,
    });

    expect(await downloadCloudMedia(b.db, USER, b.deps)).toBe(1);
    expect(b.folder.get('media/m1.jpg')).toBe('SAMPLE picture m1');
    expect(await getMedia(b.db, 'm1')).toMatchObject({ localUri: 'media/m1.jpg', dirty: false });

    // Nothing more to send either way, and phone A keeps its own file.
    expect((await runSync(b.db, server.transport, USER, { now, media: b.deps })).pushed).toBe(0);
    await runSync(a.db, server.transport, USER, { now, media: a.deps });
    expect(await getMedia(a.db, 'm1')).toMatchObject({ localUri: 'media/m1.jpg' });
    expect(await downloadCloudMedia(a.db, USER, a.deps)).toBe(0);
  });

  it('waits for Wi-Fi with Data saver on, then uploads', async () => {
    const server = createFakeServer();
    const bucket = fakeBucket();
    const a = await phone(bucket, { allowed: false });
    await addPicture(a, 'm1');

    const summary = await runSync(a.db, server.transport, USER, { now, media: a.deps });
    expect(summary.media).toEqual({ uploaded: 0, failed: 0, waiting: 1 });
    expect(bucket.files.size).toBe(0);
    // The row still syncs (other phones see a picture is coming), just without a cloud path.
    expect(server.rows('media')).toEqual([
      expect.objectContaining({ id: 'm1', remote_path: null }),
    ]);
    expect(await getMedia(a.db, 'm1')).toMatchObject({ uploadStatus: 'queued' });

    a.connection.allowed = true;
    await runSync(a.db, server.transport, USER, { now, media: a.deps });
    expect(bucket.files.has(`${USER}/m1.jpg`)).toBe(true);
    expect(server.rows('media')[0]).toMatchObject({ remote_path: `${USER}/m1.jpg` });
  });

  it('does not download on mobile data with Data saver on', async () => {
    const server = createFakeServer();
    const bucket = fakeBucket();
    const a = await phone(bucket);
    await addPicture(a, 'm1');
    await runSync(a.db, server.transport, USER, { now, media: a.deps });

    const b = await phone(bucket, { allowed: false });
    await runSync(b.db, server.transport, USER, { now, media: b.deps });
    expect(await downloadCloudMedia(b.db, USER, b.deps)).toBe(0);
    expect(b.folder.size).toBe(0);

    // A tap downloads it anyway (the student chose to).
    expect(await downloadMedia(b.db, 'm1', b.deps.cloud)).toBe(true);
    expect(b.folder.has('media/m1.jpg')).toBe(true);
  });
});

describe('uploadPendingMedia', () => {
  it('marks a failed upload, carries on with the rest, and retries it next time', async () => {
    const bucket = fakeBucket();
    const a = await phone(bucket);
    await addPicture(a, 'm1');
    await addPicture(a, 'm2');
    bucket.failNext = new Error('The object exceeded the maximum allowed size');

    expect(await uploadPendingMedia(a.db, USER, a.deps)).toEqual({
      uploaded: 1,
      failed: 1,
      waiting: 0,
    });
    expect(await getMedia(a.db, 'm1')).toMatchObject({ uploadStatus: 'failed', remotePath: null });
    expect(await getMedia(a.db, 'm2')).toMatchObject({ uploadStatus: 'uploaded' });

    expect(await uploadPendingMedia(a.db, USER, a.deps)).toEqual({
      uploaded: 1,
      failed: 0,
      waiting: 0,
    });
    expect(await getMedia(a.db, 'm1')).toMatchObject({ uploadStatus: 'uploaded' });
  });

  it('stops when the connection drops, so the sync backs off and tries again', async () => {
    const server = createFakeServer();
    const bucket = fakeBucket();
    const a = await phone(bucket);
    await addPicture(a, 'm1');
    bucket.failNext = new Error('Network request failed');

    await expect(runSync(a.db, server.transport, USER, { now, media: a.deps })).rejects.toThrow(
      'Network request failed',
    );
    expect(await getMedia(a.db, 'm1')).toMatchObject({ uploadStatus: 'failed', dirty: true });

    await runSync(a.db, server.transport, USER, { now, media: a.deps });
    expect(server.rows('media')[0]).toMatchObject({ remote_path: `${USER}/m1.jpg` });
  });

  it('skips deleted pictures and marks one whose file is gone as failed', async () => {
    const bucket = fakeBucket();
    const a = await phone(bucket);
    await addPicture(a, 'm1');
    a.folder.delete('media/m1.jpg');

    expect(await uploadPendingMedia(a.db, USER, a.deps)).toEqual({
      uploaded: 0,
      failed: 1,
      waiting: 0,
    });
    expect(bucket.files.size).toBe(0);
  });
});

describe('downloadMedia', () => {
  it('remembers a failed download so the picture can offer “try again”', async () => {
    const bucket = fakeBucket();
    const b = await phone(bucket);
    await insertMedia(
      b.db,
      {
        id: 'gone',
        ownerId: USER,
        remotePath: `${USER}/gone.jpg`,
        mime: 'image/jpeg',
        width: 10,
        height: 10,
        bytes: 100,
      },
      { now },
    );
    expect(await downloadMedia(b.db, 'gone', b.deps.cloud)).toBe(false);
    expect(getDownloadState('gone')).toBe('failed');

    bucket.files.set(`${USER}/gone.jpg`, 'SAMPLE');
    expect(await downloadMedia(b.db, 'gone', b.deps.cloud)).toBe(true);
    expect(getDownloadState('gone')).toBeNull();
  });
});
