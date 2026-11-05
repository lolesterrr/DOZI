import type { TutorialInfo } from './logic';

// The tutorial videos. They are made with HyperFrames from real screenshots of the app: see
// tools/tutorials/README.md to change or re-render them. The welcome video is built into the app
// (assets/tutorials/) so a brand-new student always has it; the others live in the public
// `tutorials` Storage bucket and download the first time they're played (task 3.7). The file
// and size here are the defaults; the bucket's manifest.json can point to a re-rendered file.

/** Where a video comes from. */
export type TutorialVideo =
  { kind: 'bundled'; asset: number } | { kind: 'cloud'; file: string; bytes: number };

export type Tutorial = TutorialInfo & {
  /** The MP4 (720 × 1280, with a soft music bed). */
  video: TutorialVideo;
  /** A still from the start of the video, for the list. */
  poster: number;
};

export const TUTORIALS: readonly Tutorial[] = [
  {
    id: '01-welcome',
    key: 'welcome',
    kind: 'tutorial',
    seconds: 70,
    video: { kind: 'bundled', asset: require('@/assets/tutorials/01-welcome.mp4') },
    poster: require('@/assets/tutorials/01-welcome.jpg'),
  },
  {
    id: '02-notes',
    key: 'notes',
    kind: 'tutorial',
    seconds: 68,
    video: { kind: 'cloud', file: '02-notes.mp4', bytes: 1968780 },
    poster: require('@/assets/tutorials/02-notes.jpg'),
  },
  {
    id: '03-decks',
    key: 'decks',
    kind: 'tutorial',
    seconds: 87,
    video: { kind: 'cloud', file: '03-decks.mp4', bytes: 3298538 },
    poster: require('@/assets/tutorials/03-decks.jpg'),
  },
  {
    id: '04-review',
    key: 'review',
    kind: 'tutorial',
    seconds: 50,
    video: { kind: 'cloud', file: '04-review.mp4', bytes: 1466777 },
    poster: require('@/assets/tutorials/04-review.jpg'),
  },
  {
    id: '05-cards-from-notes',
    key: 'cardsFromNotes',
    kind: 'tutorial',
    seconds: 32,
    video: { kind: 'cloud', file: '05-cards-from-notes.mp4', bytes: 1228321 },
    poster: require('@/assets/tutorials/05-cards-from-notes.jpg'),
  },
  {
    id: '06-quizzes',
    key: 'quizzes',
    kind: 'tutorial',
    seconds: 82,
    video: { kind: 'cloud', file: '06-quizzes.mp4', bytes: 3305658 },
    poster: require('@/assets/tutorials/06-quizzes.jpg'),
  },
  {
    id: '07-import-export',
    key: 'importExport',
    kind: 'tutorial',
    seconds: 36,
    video: { kind: 'cloud', file: '07-import-export.mp4', bytes: 1532345 },
    poster: require('@/assets/tutorials/07-import-export.jpg'),
  },
  {
    id: '08-timetable',
    key: 'timetable',
    kind: 'tutorial',
    seconds: 52,
    video: { kind: 'cloud', file: '08-timetable.mp4', bytes: 1879020 },
    poster: require('@/assets/tutorials/08-timetable.jpg'),
  },
  {
    id: '09-progress',
    key: 'progress',
    kind: 'tutorial',
    seconds: 37,
    video: { kind: 'cloud', file: '09-progress.mp4', bytes: 1710298 },
    poster: require('@/assets/tutorials/09-progress.jpg'),
  },
  {
    id: '10-soon-learn',
    key: 'soonLearn',
    kind: 'trailer',
    seconds: 23,
    video: { kind: 'cloud', file: '10-soon-learn.mp4', bytes: 570247 },
    poster: require('@/assets/tutorials/10-soon-learn.jpg'),
  },
  {
    id: '11-soon-exams',
    key: 'soonExams',
    kind: 'trailer',
    seconds: 23,
    video: { kind: 'cloud', file: '11-soon-exams.mp4', bytes: 565295 },
    poster: require('@/assets/tutorials/11-soon-exams.jpg'),
  },
  {
    id: '12-soon-together',
    key: 'soonTogether',
    kind: 'trailer',
    seconds: 23,
    video: { kind: 'cloud', file: '12-soon-together.mp4', bytes: 571011 },
    poster: require('@/assets/tutorials/12-soon-together.jpg'),
  },
];

export function findTutorial(id: string | undefined): Tutorial | null {
  return TUTORIALS.find((t) => t.id === id) ?? null;
}
