import { isNull } from 'drizzle-orm';

import { media } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { getProfile } from '@/features/profile/repo';
import { getAppSettings } from '@/features/settings/repo';
import { toRemote } from '@/features/sync/logic';
import { profileToRemote } from '@/features/sync/repo';
import { SYNC_TABLES } from '@/features/sync/tables';

import { ZipWriter } from './zip';

// "Export my data" (task 3.6, PRODUCT_SPEC §12, Data Protection and Privacy Act 2019): everything
// the student has on this phone as one zip, `dozi-data.json` plus the pictures under `media/`.
// It works signed in or not, and includes changes that haven't been backed up yet.

export const EXPORT_FORMAT = 'dozi-export';
export const EXPORT_VERSION = 1;

export type MyDataSummary = {
  /** Rows in `dozi-data.json`, all tables together. */
  rows: number;
  pictures: number;
  /** Pictures that are only in the backup (not downloaded to this phone), so not in the zip. */
  missingPictures: number;
};

/** The zip's file name, e.g. `dozi-my-data-2026-11-05.zip`. */
export function myDataFileName(nowIso: string): string {
  return `dozi-my-data-${nowIso.slice(0, 10)}.zip`;
}

const readme = (exportedAt: string, missing: number) =>
  [
    'Dozi: your data',
    `Exported ${exportedAt}.`,
    '',
    'dozi-data.json holds your profile, settings and everything you made or did in Dozi:',
    'notes, decks, cards, questions, quizzes, review history, XP, streak, badges and timetable.',
    'Each table is a list of rows; the column names match the Dozi database (docs/ARCHITECTURE.md).',
    'Deleted items are included with a deleted_at date.',
    '',
    'media/ holds your pictures, named by their id (notes and cards refer to them as media://<id>).',
    missing > 0
      ? `${missing} picture(s) are only in your online backup and not on this phone, so they are not in this zip.`
      : '',
    '',
    'For study purposes only, not for clinical decisions.',
  ]
    .filter((line, index, all) => line !== '' || all[index - 1] !== '')
    .join('\n');

/**
 * Writes the export into `zip`. `readPicture` gives a picture's bytes from its stored relative
 * path, or null if the file isn't on this phone.
 */
export async function writeMyData(
  db: AppDatabase,
  zip: ZipWriter,
  readPicture: (relativePath: string) => Uint8Array | null,
  { now }: { now: () => string },
): Promise<MyDataSummary> {
  const exportedAt = now();
  const profile = await getProfile(db);
  const tables: Record<string, unknown[]> = {};
  let rows = 0;
  for (const t of SYNC_TABLES) {
    const local = (await db.select().from(t.table)) as Record<string, unknown>[];
    tables[t.name] = local.map((row) => toRemote(t, row));
    rows += local.length;
  }

  let pictures = 0;
  let missingPictures = 0;
  const live = await db.select().from(media).where(isNull(media.deletedAt));
  const files: { path: string; bytes: Uint8Array }[] = [];
  for (const row of live) {
    const bytes = row.localUri ? readPicture(row.localUri) : null;
    if (bytes) {
      files.push({ path: `media/${row.id}.jpg`, bytes });
      pictures++;
    } else if (row.remotePath) {
      missingPictures++;
    }
  }

  zip.addFile('README.txt', readme(exportedAt, missingPictures));
  zip.addFile(
    'dozi-data.json',
    JSON.stringify(
      {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt,
        profile: profile ? profileToRemote(profile) : null,
        settings: await getAppSettings(db),
        tables,
      },
      null,
      2,
    ),
  );
  for (const file of files) zip.addFile(file.path, file.bytes);
  zip.finish();
  return { rows, pictures, missingPictures };
}
