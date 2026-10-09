import { Directory, File, Paths } from 'expo-file-system';

import { MEDIA_DIR, mediaFileName, mediaRelativePath, type StoredFile } from './logic';

/**
 * The media folder on the device. The pipeline talks to it through this interface so tests can
 * swap in an in-memory version.
 */
export type MediaFileStore = {
  /** Moves a file (e.g. the compressed image in the cache) into the media folder. */
  adopt(sourceUri: string, id: string): { relativePath: string; bytes: number };
  /** Size in bytes of any file:// uri, or null if it can't be read. */
  sizeOf(uri: string): number | null;
  /** A file:// uri for a stored relative path, or null if the file is missing. */
  resolve(relativePath: string): string | null;
  list(): StoredFile[];
  remove(name: string): void;
};

function mediaDirectory(): Directory {
  const dir = new Directory(Paths.document, MEDIA_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** The real media folder: `<documents>/media/`. */
export const deviceMediaStore: MediaFileStore = {
  adopt(sourceUri, id) {
    const source = new File(sourceUri);
    const target = new File(mediaDirectory(), mediaFileName(id));
    source.moveSync(target, { overwrite: true });
    return { relativePath: mediaRelativePath(id), bytes: target.size };
  },
  sizeOf(uri) {
    try {
      const file = new File(uri);
      return file.exists ? file.size : null;
    } catch {
      return null;
    }
  },
  resolve(relativePath) {
    const file = new File(Paths.document, relativePath);
    return file.exists ? file.uri : null;
  },
  list() {
    return mediaDirectory()
      .list()
      .filter((entry): entry is File => entry instanceof File)
      .map((file) => ({ name: file.name, modifiedMs: file.modificationTime ?? null }));
  },
  remove(name) {
    const file = new File(mediaDirectory(), name);
    if (file.exists) file.delete();
  },
};
