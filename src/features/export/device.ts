import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { AppDatabase } from '@/db/types';
import { deviceMediaStore } from '@/features/media/files';
import { getMedia } from '@/features/media/repo';

import type { ImageSources } from './logic';

// The phone side of import and export (task 1.12): picking a file, writing files to share,
// printing HTML to PDF and opening the share sheet. Kept thin; the rules are in logic.ts and
// decks/csv.ts. Mocked in component tests.

/** The biggest CSV that can be imported (a 5000-card deck is well under this). */
export const IMPORT_FILE_MAX_BYTES = 2 * 1024 * 1024;

export type PickedText =
  | { status: 'cancelled' }
  | { status: 'tooBig' }
  | { status: 'unreadable' }
  | { status: 'ok'; name: string; text: string };

/** Lets the student pick a CSV or text file and reads it as UTF-8 text. */
export async function pickTextFile(): Promise<PickedText> {
  const result = await DocumentPicker.getDocumentAsync({
    // Some phones label CSV files as plain text or as a spreadsheet, so accept those too.
    type: [
      'text/csv',
      'text/comma-separated-values',
      'text/plain',
      'text/tab-separated-values',
      'application/csv',
      'application/vnd.ms-excel',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return { status: 'cancelled' };
  const asset = result.assets[0];
  try {
    const file = new File(asset.uri);
    const size = asset.size ?? file.size;
    if (size > IMPORT_FILE_MAX_BYTES) return { status: 'tooBig' };
    const text = await file.text();
    return { status: 'ok', name: asset.name, text };
  } catch {
    return { status: 'unreadable' };
  }
}

/** The folder for files made to be shared. Emptied each time, so it never grows. */
function exportsDirectory(): Directory {
  const dir = new Directory(Paths.cache, 'exports');
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

async function share(uri: string, mimeType: string, uti: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType, UTI: uti, dialogTitle });
  return true;
}

/** Writes a CSV file with this name and opens the share sheet. False if sharing isn't possible. */
export async function shareCsv(name: string, csv: string, dialogTitle: string): Promise<boolean> {
  const file = new File(exportsDirectory(), name);
  file.create({ overwrite: true });
  file.writeSync(csv);
  return share(file.uri, 'text/csv', 'public.comma-separated-values-text', dialogTitle);
}

/** Prints HTML to a PDF with this name and opens the share sheet. */
export async function sharePdf(name: string, html: string, dialogTitle: string): Promise<boolean> {
  const printed = await Print.printToFileAsync({ html });
  const target = new File(exportsDirectory(), name);
  new File(printed.uri).moveSync(target, { overwrite: true });
  return share(target.uri, 'application/pdf', 'com.adobe.pdf', dialogTitle);
}

/**
 * Reads images as `data:` URIs for the PDF (the print engine can't open app files). An image
 * whose file isn't on this phone (deleted, or not downloaded yet) maps to null.
 */
export async function loadImageSources(
  db: AppDatabase,
  mediaIds: readonly string[],
): Promise<ImageSources> {
  const sources = new Map<string, string | null>();
  for (const id of mediaIds) {
    if (sources.has(id)) continue;
    try {
      const row = await getMedia(db, id);
      const uri = row?.localUri ? deviceMediaStore.resolve(row.localUri) : null;
      sources.set(
        id,
        uri ? `data:${row?.mime ?? 'image/jpeg'};base64,${await new File(uri).base64()}` : null,
      );
    } catch {
      sources.set(id, null);
    }
  }
  return sources;
}
