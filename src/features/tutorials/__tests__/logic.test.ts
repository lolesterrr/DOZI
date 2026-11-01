import {
  formatClock,
  groupTutorials,
  nextTutorial,
  splitDuration,
  totalSeconds,
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
