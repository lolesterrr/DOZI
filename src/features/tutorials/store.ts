import { createLogger } from '@/lib/logger';

import type { Tutorial } from './catalog';
import type { TutorialFiles } from './files';
import {
  cloudFile,
  parseManifest,
  staleVideoFiles,
  TUTORIALS_MANIFEST,
  tutorialUrl,
  type TutorialManifest,
} from './logic';

// Which tutorial videos are on the phone, and downloading the others (task 3.7). Downloads keep
// going when the student leaves the player, and the list shows how far they've got.

const log = createLogger('tutorials');

export type TutorialDeps = {
  files: TutorialFiles;
  /** The Supabase project URL, or null when the app isn't connected to one. */
  projectUrl: string | null;
  /** GETs a URL as text; throws if it fails. */
  fetchText: (url: string) => Promise<string>;
};

type Download = { state: 'downloading'; progress: number } | { state: 'failed' };

let manifest: TutorialManifest | null = null;
let manifestLoaded = false;
let manifestRefreshed = false;
const downloads = new Map<string, Download>();
let revision = 0;
const listeners = new Set<() => void>();

function changed() {
  revision++;
  listeners.forEach((listener) => listener());
}

/** Changes whenever a download starts, moves, ends or files are removed. */
export function getTutorialsRevision(): number {
  return revision;
}

export function subscribeTutorials(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The manifest last fetched, kept on the phone so it works offline. */
function currentManifest(files: TutorialFiles): TutorialManifest | null {
  if (!manifestLoaded) {
    manifest = parseManifest(files.readText(TUTORIALS_MANIFEST));
    manifestLoaded = true;
  }
  return manifest;
}

/** The file and size of a cloud video right now, or null for the built-in one. */
export function videoFile(
  tutorial: Tutorial,
  files: TutorialFiles,
): { file: string; bytes: number } | null {
  if (tutorial.video.kind === 'bundled') return null;
  return cloudFile(tutorial.id, tutorial.video, currentManifest(files));
}

export type VideoStatus =
  /** Ready to play: built in (an asset number) or downloaded (a file:// uri). */
  | { kind: 'ready'; source: number | string }
  | {
      kind: 'cloud';
      bytes: number;
      state: 'idle' | 'downloading' | 'failed';
      /** 0–1 while downloading. */
      progress: number;
    }
  /** Not on the phone, and this build has no cloud to download it from. */
  | { kind: 'unavailable' };

export function videoStatus(tutorial: Tutorial, deps: TutorialDeps): VideoStatus {
  if (tutorial.video.kind === 'bundled') return { kind: 'ready', source: tutorial.video.asset };
  const cloud = videoFile(tutorial, deps.files);
  if (!cloud) return { kind: 'unavailable' };
  const uri = deps.files.uri(cloud.file);
  if (uri) return { kind: 'ready', source: uri };
  if (!deps.projectUrl) return { kind: 'unavailable' };
  const download = downloads.get(tutorial.id);
  return {
    kind: 'cloud',
    bytes: cloud.bytes,
    state: download?.state ?? 'idle',
    progress: download?.state === 'downloading' ? download.progress : 0,
  };
}

/**
 * Fetches the bucket's manifest (once per app run), keeps it for offline use and removes videos
 * that a re-render replaced. Offline or not set up: nothing changes.
 */
export async function refreshManifest(
  tutorials: readonly Tutorial[],
  deps: TutorialDeps,
): Promise<void> {
  if (manifestRefreshed || !deps.projectUrl) return;
  try {
    const text = await deps.fetchText(tutorialUrl(deps.projectUrl, TUTORIALS_MANIFEST));
    const fresh = parseManifest(text);
    if (!fresh) {
      log.warn('The tutorials manifest is not valid');
      return;
    }
    manifestRefreshed = true;
    deps.files.writeText(TUTORIALS_MANIFEST, text);
    manifest = fresh;
    manifestLoaded = true;
    const current = tutorials
      .map((t) => videoFile(t, deps.files)?.file)
      .filter((f): f is string => !!f);
    const stale = staleVideoFiles(deps.files.list(), current);
    stale.forEach((name) => deps.files.remove(name));
    changed();
  } catch (error) {
    log.info('Could not fetch the tutorials manifest', { error: String(error) });
  }
}

/** Downloads one video. True when it's on the phone afterwards. */
export async function downloadTutorial(tutorial: Tutorial, deps: TutorialDeps): Promise<boolean> {
  const cloud = videoFile(tutorial, deps.files);
  if (!cloud) return true;
  if (deps.files.uri(cloud.file)) return true;
  if (!deps.projectUrl) return false;
  if (downloads.get(tutorial.id)?.state === 'downloading') return false;
  downloads.set(tutorial.id, { state: 'downloading', progress: 0 });
  changed();
  let lastStep = 0;
  try {
    await deps.files.download(tutorialUrl(deps.projectUrl, cloud.file), cloud.file, (fraction) => {
      // Redraw at most every 5 %, so a slow phone isn't busy repainting a progress bar.
      const step = Math.floor(fraction * 20);
      if (step === lastStep) return;
      lastStep = step;
      downloads.set(tutorial.id, { state: 'downloading', progress: fraction });
      changed();
    });
    downloads.delete(tutorial.id);
    changed();
    return true;
  } catch (error) {
    log.warn('Tutorial download failed', { id: tutorial.id, error: String(error) });
    downloads.set(tutorial.id, { state: 'failed' });
    changed();
    return false;
  }
}

/** How much space the downloaded videos take. */
export function downloadedBytes(tutorials: readonly Tutorial[], deps: TutorialDeps): number {
  return tutorials.reduce((sum, t) => {
    const cloud = videoFile(t, deps.files);
    return cloud ? sum + deps.files.size(cloud.file) : sum;
  }, 0);
}

/** Removes every downloaded video (they download again when played). */
export function removeDownloads(deps: TutorialDeps): void {
  deps.files
    .list()
    .filter((name) => name !== TUTORIALS_MANIFEST)
    .forEach((name) => deps.files.remove(name));
  changed();
}

/** For tests: forget everything. */
export function resetTutorialsForTests() {
  manifest = null;
  manifestLoaded = false;
  manifestRefreshed = false;
  downloads.clear();
  listeners.clear();
  revision = 0;
}
