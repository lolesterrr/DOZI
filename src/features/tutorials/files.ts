import { Directory, File, Paths } from 'expo-file-system';

// The downloaded tutorial videos: `<documents>/tutorials/` (task 3.7). The rest of the feature
// reaches the folder through `TutorialFiles`, so tests can use an in-memory one.

export type TutorialFiles = {
  /** A file:// uri for a downloaded file, or null if it isn't on the phone. */
  uri(name: string): string | null;
  /** The names of the files in the folder. */
  list(): string[];
  /** Size in bytes of a downloaded file (0 if it isn't there). */
  size(name: string): number;
  remove(name: string): void;
  readText(name: string): string | null;
  writeText(name: string, text: string): void;
  /**
   * Downloads `url` as `name`. The file only appears once it is complete, so a dropped connection
   * never leaves half a video behind.
   */
  download(url: string, name: string, onProgress: (fraction: number) => void): Promise<void>;
};

const FOLDER = 'tutorials';

function folder(): Directory {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export const deviceTutorialFiles: TutorialFiles = {
  // Reads never throw (e.g. on the web build used for tutorial screenshots): a file that can't
  // be read counts as not downloaded.
  uri(name) {
    try {
      const file = new File(Paths.document, FOLDER, name);
      return file.exists ? file.uri : null;
    } catch {
      return null;
    }
  },
  list() {
    try {
      return folder()
        .list()
        .filter((entry): entry is File => entry instanceof File)
        .map((file) => file.name);
    } catch {
      return [];
    }
  },
  size(name) {
    try {
      const file = new File(Paths.document, FOLDER, name);
      return file.exists ? file.size : 0;
    } catch {
      return 0;
    }
  },
  remove(name) {
    const file = new File(Paths.document, FOLDER, name);
    if (file.exists) file.delete();
  },
  readText(name) {
    try {
      const file = new File(Paths.document, FOLDER, name);
      return file.exists ? file.textSync() : null;
    } catch {
      return null;
    }
  },
  writeText(name, text) {
    new File(folder(), name).write(text);
  },
  async download(url, name, onProgress) {
    const partial = new File(Paths.cache, `${name}.part`);
    await File.downloadFileAsync(url, partial, {
      idempotent: true,
      onProgress: ({ bytesWritten, totalBytes }) => {
        if (totalBytes > 0) onProgress(Math.min(1, bytesWritten / totalBytes));
      },
    });
    partial.moveSync(new File(folder(), name), { overwrite: true });
  },
};
