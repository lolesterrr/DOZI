import {
  cloudFile,
  downloadPlan,
  formatClock,
  groupTutorials,
  isVideoFile,
  nextTutorial,
  parseManifest,
  splitDuration,
  staleVideoFiles,
  totalSeconds,
  tutorialUrl,
  type TutorialInfo,
} from '../logic';

const list: TutorialInfo[] = [
  { id: 'a', key: 'welcome', kind: 'tutorial', seconds: 47 },
  { id: 'b', key: 'notes', kind: 'tutorial', seconds: 61 },
  { id: 'c', key: 'soonLearn', kind: 'trailer', seconds: 20 },
  { id: 'd', key: 'soonExams', kind: 'trailer', seconds: 20 },
];

describe('formatClock', () => {
  it('shows minutes and two-digit seconds', () => {
    expect(formatClock(47)).toBe('0:47');
    expect(formatClock(61)).toBe('1:01');
    expect(formatClock(125)).toBe('2:05');
  });

  it('rounds and never goes below zero', () => {
    expect(formatClock(46.6)).toBe('0:47');
    expect(formatClock(-3)).toBe('0:00');
  });
});

describe('splitDuration', () => {
  it('splits into minutes and seconds', () => {
    expect(splitDuration(125)).toEqual({ minutes: 2, seconds: 5 });
    expect(splitDuration(20)).toEqual({ minutes: 0, seconds: 20 });
  });
});

describe('groupTutorials', () => {
  it('keeps tutorials and trailers apart, in order', () => {
    const { tutorials, trailers } = groupTutorials(list);
    expect(tutorials.map((t) => t.id)).toEqual(['a', 'b']);
    expect(trailers.map((t) => t.id)).toEqual(['c', 'd']);
  });
});

describe('nextTutorial', () => {
  it('offers the next video of the same kind', () => {
    expect(nextTutorial(list, 'a')?.id).toBe('b');
    expect(nextTutorial(list, 'c')?.id).toBe('d');
  });

  it('offers nothing after the last tutorial, the last trailer or an unknown id', () => {
    expect(nextTutorial(list, 'b')).toBeNull();
    expect(nextTutorial(list, 'd')).toBeNull();
    expect(nextTutorial(list, 'zzz')).toBeNull();
  });
});

describe('totalSeconds', () => {
  it('adds up the running time', () => {
    expect(totalSeconds(list)).toBe(148);
  });
});

describe('cloud videos', () => {
  const manifestText = JSON.stringify({
    version: 1,
    videos: [{ id: '03-decks', file: '03-decks.v2.mp4', bytes: 3_400_000 }],
  });

  it('reads a valid manifest and refuses anything else', () => {
    expect(parseManifest(manifestText)?.videos).toHaveLength(1);
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest('not json')).toBeNull();
    expect(parseManifest(JSON.stringify({ version: 2, videos: [] }))).toBeNull();
    expect(
      parseManifest(
        JSON.stringify({ version: 1, videos: [{ id: 'x', file: '../evil.mp4', bytes: 1 }] }),
      ),
    ).toBeNull();
  });

  it('knows a video file name when it sees one', () => {
    expect(isVideoFile('02-notes.mp4')).toBe(true);
    expect(isVideoFile('02-notes.v3.mp4')).toBe(true);
    expect(isVideoFile('manifest.json')).toBe(false);
    expect(isVideoFile('02-notes.mp4.part')).toBe(false);
  });

  it('takes the file from the manifest, falling back to the app’s own', () => {
    const builtIn = { file: '03-decks.mp4', bytes: 3_298_538 };
    const manifest = parseManifest(manifestText);
    expect(cloudFile('03-decks', builtIn, manifest)).toEqual({
      file: '03-decks.v2.mp4',
      bytes: 3_400_000,
    });
    expect(cloudFile('03-decks', builtIn, null)).toEqual(builtIn);
    expect(cloudFile('04-review', { file: '04-review.mp4', bytes: 9 }, manifest)).toEqual({
      file: '04-review.mp4',
      bytes: 9,
    });
  });

  it('builds the public link', () => {
    expect(tutorialUrl('https://abc.supabase.co/', '02-notes.mp4')).toBe(
      'https://abc.supabase.co/storage/v1/object/public/tutorials/02-notes.mp4',
    );
  });

  it('finds videos a re-render replaced', () => {
    expect(
      staleVideoFiles(
        ['03-decks.mp4', '03-decks.v2.mp4', '02-notes.mp4', 'manifest.json'],
        ['03-decks.v2.mp4', '02-notes.mp4'],
      ),
    ).toEqual(['03-decks.mp4']);
  });

  it('downloads on Wi-Fi, asks on mobile data with Data saver on, and waits offline', () => {
    expect(downloadPlan(true, 'wifi')).toBe('download');
    expect(downloadPlan(true, 'cellular')).toBe('ask');
    expect(downloadPlan(true, 'unknown')).toBe('ask');
    expect(downloadPlan(false, 'cellular')).toBe('download');
    expect(downloadPlan(false, 'none')).toBe('offline');
    expect(downloadPlan(true, 'none')).toBe('offline');
  });
});
