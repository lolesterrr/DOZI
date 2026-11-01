// Pure helpers for the tutorial videos (Me → Tutorials).

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
