import { insertMedia } from '@/features/media/repo';
import { createNote } from '@/features/notes/repo';
import { ensureProfile } from '@/features/profile/repo';
import { createTestDatabase } from '@/test-utils/db';
import { memorySink, readZip } from '@/test-utils/readZip';

import { myDataFileName, writeMyData } from '../myData';
import { ZipWriter } from '../zip';

// SAMPLE data for tests only.
const now = () => '2026-11-05T10:00:00.000Z';

async function setup() {
  const db = createTestDatabase();
  const profile = await ensureProfile(db, { newId: () => 'owner-1', now });
  await createNote(db, { ownerId: 'owner-1', title: 'SAMPLE note' }, { newId: () => 'n1', now });
  const picture = (id: string, localUri: string | null, remotePath: string | null) =>
    insertMedia(
      db,
      {
        id,
        ownerId: 'owner-1',
        localUri,
        remotePath,
        mime: 'image/jpeg',
        width: 10,
        height: 10,
        bytes: 3,
      },
      { now },
    );
  await picture('m1', 'media/m1.jpg', null);
  await picture('m2', null, 'owner-1/m2.jpg'); // only in the backup
  return { db, profile };
}

describe('Export my data', () => {
  it('names the zip after the day', () => {
    expect(myDataFileName('2026-11-05T10:00:00.000Z')).toBe('dozi-my-data-2026-11-05.zip');
  });

  it('puts the data and the pictures on this phone into one zip', async () => {
    const { db } = await setup();
    const sink = memorySink();
    const files = new Map([['media/m1.jpg', new Uint8Array([1, 2, 3])]]);

    const summary = await writeMyData(
      db,
      new ZipWriter(sink.write),
      (path) => files.get(path) ?? null,
      { now },
    );

    expect(summary).toMatchObject({ pictures: 1, missingPictures: 1 });
    const zip = readZip(sink.bytes());
    expect([...zip.keys()]).toEqual(['README.txt', 'dozi-data.json', 'media/m1.jpg']);
    expect([...(zip.get('media/m1.jpg') ?? [])]).toEqual([1, 2, 3]);
    expect(new TextDecoder().decode(zip.get('README.txt'))).toContain(
      '1 picture(s) are only in your online backup',
    );

    const data = JSON.parse(new TextDecoder().decode(zip.get('dozi-data.json')));
    expect(data).toMatchObject({ format: 'dozi-export', version: 1, exportedAt: now() });
    expect(data.profile).toMatchObject({ id: 'owner-1', daily_goal_xp: 50 });
    expect(data.settings).toHaveProperty('wifiOnly');
    expect(data.tables.notes).toEqual([
      expect.objectContaining({ id: 'n1', owner_id: 'owner-1', title: 'SAMPLE note' }),
    ]);
    expect(data.tables.media).toHaveLength(2);
    // Local-only bookkeeping isn't exported.
    expect(data.tables.media[0]).not.toHaveProperty('local_uri');
    expect(data.tables.notes[0]).not.toHaveProperty('_dirty');
    expect(summary.rows).toBe(
      Object.values(data.tables as Record<string, unknown[]>).reduce((n, r) => n + r.length, 0),
    );
  });
});
