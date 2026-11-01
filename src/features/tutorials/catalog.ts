import type { TutorialInfo } from './logic';

// The tutorial videos bundled with the app (assets/tutorials/). They are made with HyperFrames
// from real screenshots of the app: see tools/tutorials/README.md to change or re-render them.
// Later they may download from the cloud instead (ROADMAP task 3.7).

export type Tutorial = TutorialInfo & {
  /** The MP4 file (720 × 1280, with a soft music bed). */
  video: number;
  /** A still from the start of the video, for the list. */
  poster: number;
};

export const TUTORIALS: readonly Tutorial[] = [
  {
    id: '01-welcome',
    key: 'welcome',
    kind: 'tutorial',
    seconds: 70,
    video: require('@/assets/tutorials/01-welcome.mp4'),
    poster: require('@/assets/tutorials/01-welcome.jpg'),
  },
  {
    id: '02-notes',
    key: 'notes',
    kind: 'tutorial',
    seconds: 68,
    video: require('@/assets/tutorials/02-notes.mp4'),
    poster: require('@/assets/tutorials/02-notes.jpg'),
  },
  {
    id: '03-decks',
    key: 'decks',
    kind: 'tutorial',
    seconds: 87,
    video: require('@/assets/tutorials/03-decks.mp4'),
    poster: require('@/assets/tutorials/03-decks.jpg'),
  },
  {
    id: '04-review',
    key: 'review',
    kind: 'tutorial',
    seconds: 50,
    video: require('@/assets/tutorials/04-review.mp4'),
    poster: require('@/assets/tutorials/04-review.jpg'),
  },
  {
    id: '05-cards-from-notes',
    key: 'cardsFromNotes',
    kind: 'tutorial',
    seconds: 32,
    video: require('@/assets/tutorials/05-cards-from-notes.mp4'),
    poster: require('@/assets/tutorials/05-cards-from-notes.jpg'),
  },
  {
    id: '06-quizzes',
    key: 'quizzes',
    kind: 'tutorial',
    seconds: 82,
    video: require('@/assets/tutorials/06-quizzes.mp4'),
    poster: require('@/assets/tutorials/06-quizzes.jpg'),
  },
  {
    id: '07-import-export',
    key: 'importExport',
    kind: 'tutorial',
    seconds: 36,
    video: require('@/assets/tutorials/07-import-export.mp4'),
    poster: require('@/assets/tutorials/07-import-export.jpg'),
  },
  {
    id: '08-timetable',
    key: 'timetable',
    kind: 'tutorial',
    seconds: 52,
    video: require('@/assets/tutorials/08-timetable.mp4'),
    poster: require('@/assets/tutorials/08-timetable.jpg'),
  },
  {
    id: '09-progress',
    key: 'progress',
    kind: 'tutorial',
    seconds: 37,
    video: require('@/assets/tutorials/09-progress.mp4'),
    poster: require('@/assets/tutorials/09-progress.jpg'),
  },
  {
    id: '10-soon-learn',
    key: 'soonLearn',
    kind: 'trailer',
    seconds: 23,
    video: require('@/assets/tutorials/10-soon-learn.mp4'),
    poster: require('@/assets/tutorials/10-soon-learn.jpg'),
  },
  {
    id: '11-soon-exams',
    key: 'soonExams',
    kind: 'trailer',
    seconds: 23,
    video: require('@/assets/tutorials/11-soon-exams.mp4'),
    poster: require('@/assets/tutorials/11-soon-exams.jpg'),
  },
  {
    id: '12-soon-together',
    key: 'soonTogether',
    kind: 'trailer',
    seconds: 23,
    video: require('@/assets/tutorials/12-soon-together.mp4'),
    poster: require('@/assets/tutorials/12-soon-together.jpg'),
  },
];

export function findTutorial(id: string | undefined): Tutorial | null {
  return TUTORIALS.find((t) => t.id === id) ?? null;
}
