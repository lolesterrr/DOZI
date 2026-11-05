// Pure helpers for the tutorial videos (Me → Tutorials).

import { z } from 'zod';

export type TutorialKind = 'tutorial' | 'trailer';

export type TutorialKey =
  | 'welcome'
  | 'notes'
  | 'decks'
  | 'review'
  | 'cardsFromNotes'
  | 'quizzes'
  | 'importExport'
  | 'timetable'
  | 'progress'
  | 'soonLearn'
  | 'soonExams'
  | 'soonTogether';

/** What the logic needs to know about a video (the asset itself lives in catalog.ts). */
export type TutorialInfo = {
  id: string;
  key: TutorialKey;
  kind: TutorialKind;
  /** Length in whole seconds. */
  seconds: number;
};

/** 47 → "0:47", 125 → "2:05". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Splits a length into minutes and seconds, for screen readers. */
export function splitDuration(totalSeconds: number): { minutes: number; seconds: number } {
  const s = Math.max(0, Math.round(totalSeconds));
  return { minutes: Math.floor(s / 60), seconds: s % 60 };
}

/** Feature tutorials first (in order), then the "coming soon" trailers. */
export function groupTutorials<T extends TutorialInfo>(
  list: readonly T[],
): {
  tutorials: T[];
  trailers: T[];
} {
  return {
    tutorials: list.filter((t) => t.kind === 'tutorial'),
    trailers: list.filter((t) => t.kind === 'trailer'),
  };
}

/** The video to offer after this one: the next of the same kind, or none at the end. */
export function nextTutorial<T extends TutorialInfo>(list: readonly T[], id: string): T | null {
  const index = list.findIndex((t) => t.id === id);
  if (index < 0) return null;
  const next = list[index + 1];
  return next && next.kind === list[index].kind ? next : null;
}

/** Total running time of a list, in seconds. */
export function totalSeconds(list: readonly TutorialInfo[]): number {
  return list.reduce((sum, t) => sum + t.seconds, 0);
}

// ---------------------------------------------------------------------------------------------
// Cloud videos (task 3.7). The welcome video is built into the app; the rest download from the
// public `tutorials` Storage bucket the first time they're played, then stay on the phone.
// ---------------------------------------------------------------------------------------------

/** The public Storage bucket that holds the videos and their manifest. */
export const TUTORIALS_BUCKET = 'tutorials';
export const TUTORIALS_MANIFEST = 'manifest.json';

/** A video file name: `02-notes.mp4`, or `02-notes.v2.mp4` after a re-render. */
const VIDEO_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.v\d+)?\.mp4$/;

const manifestSchema = z.object({
  version: z.literal(1),
  videos: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      file: z.string().regex(VIDEO_FILE),
      bytes: z.number().int().positive(),
    }),
  ),
});

/** `manifest.json` in the bucket: which file holds each video now, and how big it is. */
export type TutorialManifest = z.infer<typeof manifestSchema>;

/** The manifest from its JSON text, or null if it isn't one. */
export function parseManifest(text: string | null): TutorialManifest | null {
  if (!text) return null;
  try {
    const result = manifestSchema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function isVideoFile(name: string): boolean {
  return VIDEO_FILE.test(name);
}

/** A cloud video's file and size: the manifest's if it lists the video, else the app's own. */
export function cloudFile(
  id: string,
  builtIn: { file: string; bytes: number },
  manifest: TutorialManifest | null,
): { file: string; bytes: number } {
  const listed = manifest?.videos.find((v) => v.id === id);
  return listed ? { file: listed.file, bytes: listed.bytes } : builtIn;
}

/** The public link to a file in the bucket. */
export function tutorialUrl(projectUrl: string, file: string): string {
  return `${projectUrl.replace(/\/+$/, '')}/storage/v1/object/public/${TUTORIALS_BUCKET}/${file}`;
}

/** Downloaded videos that no current video uses any more (replaced by a re-render). */
export function staleVideoFiles(stored: readonly string[], current: readonly string[]): string[] {
  const keep = new Set(current);
  return stored.filter((name) => isVideoFile(name) && !keep.has(name));
}

/**
 * Opening a video that isn't on the phone yet: download it straight away, ask first (Data saver
 * is on and this isn't Wi-Fi), or say the phone is offline.
 */
export type DownloadPlan = 'download' | 'ask' | 'offline';

export function downloadPlan(
  wifiOnly: boolean,
  connection: 'wifi' | 'cellular' | 'none' | 'unknown',
): DownloadPlan {
  if (connection === 'none') return 'offline';
  if (connection === 'wifi' || !wifiOnly) return 'download';
  return 'ask';
}
