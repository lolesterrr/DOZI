import {
  CLEANUP_INTERVAL_MS,
  findOrphanFiles,
  formatBytes,
  isCleanupDue,
  mediaRef,
  mediaRelativePath,
  parseMediaRef,
  percentSaved,
  resizeTarget,
} from '../logic';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.parse('2026-10-09T12:00:00.000Z');

describe('resizeTarget', () => {
  it.each([
    [
      { width: 4000, height: 3000 },
      { width: 1600, height: 1200 },
    ],
    [
      { width: 3000, height: 4000 },
      { width: 1200, height: 1600 },
    ],
    [
      { width: 4032, height: 4032 },
      { width: 1600, height: 1600 },
    ],
    [
      { width: 1601, height: 10 },
      { width: 1600, height: 10 },
    ],
    [
      { width: 20000, height: 5 },
      { width: 1600, height: 1 },
    ],
  ])('shrinks %o so the long edge is 1600 px', (size, expected) => {
    expect(resizeTarget(size)).toEqual(expected);
  });

  it.each([
    { width: 1600, height: 900 },
    { width: 800, height: 600 },
    { width: 0, height: 0 },
  ])('leaves %o alone', (size) => {
    expect(resizeTarget(size)).toBeNull();
  });

  it('honours a custom limit', () => {
    expect(resizeTarget({ width: 1000, height: 500 }, 400)).toEqual({ width: 400, height: 200 });
  });
});

describe('media references', () => {
  it('round-trips an id through media://', () => {
    const id = '0b9e5c2e-4f1a-4c1e-9d3e-2a6f7b8c9d0e';
    expect(mediaRef(id)).toBe(`media://${id}`);
    expect(parseMediaRef(mediaRef(id))).toBe(id);
  });

  it.each(['https://example.com/a.jpg', 'media://', 'media://../etc/passwd', 'file:///x.jpg'])(
    'rejects %s',
    (ref) => {
      expect(parseMediaRef(ref)).toBeNull();
    },
  );

  it('stores files under media/ relative to the documents folder', () => {
    expect(mediaRelativePath('abc')).toBe('media/abc.jpg');
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 KB'],
    [-5, '0 KB'],
    [200, '1 KB'],
    [312 * 1024, '312 KB'],
    [4.2 * 1024 * 1024, '4.2 MB'],
    [3 * 1024 * 1024 * 1024, '3.00 GB'],
  ])('%d bytes → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe('percentSaved', () => {
  it('is the size reduction in whole percent', () => {
    expect(percentSaved(4_000_000, 300_000)).toBe(93);
  });
  it('is 0 when the file did not shrink or the original size is unknown', () => {
    expect(percentSaved(100, 120)).toBe(0);
    expect(percentSaved(0, 120)).toBe(0);
  });
});

describe('isCleanupDue', () => {
  it('is due the first time', () => {
    expect(isCleanupDue(undefined, NOW)).toBe(true);
  });
  it('is not due within a week', () => {
    expect(isCleanupDue(new Date(NOW - 6 * DAY).toISOString(), NOW)).toBe(false);
  });
  it('is due after a week', () => {
    expect(isCleanupDue(new Date(NOW - CLEANUP_INTERVAL_MS).toISOString(), NOW)).toBe(true);
  });
  it('is due if the saved time is garbage or in the future (clock changed)', () => {
    expect(isCleanupDue('not a date', NOW)).toBe(true);
    expect(isCleanupDue(new Date(NOW + DAY).toISOString(), NOW)).toBe(true);
  });
});

describe('findOrphanFiles', () => {
  const old = NOW - 2 * HOUR;

  it('removes files no row points at', () => {
    const files = [
      { name: 'a.jpg', modifiedMs: old },
      { name: 'b.jpg', modifiedMs: old },
    ];
    const rows = [{ localUri: 'media/a.jpg', deletedAt: null }];
    expect(findOrphanFiles(files, rows, NOW)).toEqual(['b.jpg']);
  });

  it('keeps files written in the last hour (the row may not be saved yet)', () => {
    const files = [{ name: 'new.jpg', modifiedMs: NOW - 5 * 60 * 1000 }];
    expect(findOrphanFiles(files, [], NOW)).toEqual([]);
  });

  it('keeps a soft-deleted image for 30 days so it can be undone, then removes it', () => {
    const files = [
      { name: 'recent.jpg', modifiedMs: old },
      { name: 'expired.jpg', modifiedMs: old },
    ];
    const rows = [
      { localUri: 'media/recent.jpg', deletedAt: new Date(NOW - 10 * DAY).toISOString() },
      { localUri: 'media/expired.jpg', deletedAt: new Date(NOW - 31 * DAY).toISOString() },
    ];
    expect(findOrphanFiles(files, rows, NOW)).toEqual(['expired.jpg']);
  });

  it('treats a file with an unknown age as old', () => {
    expect(findOrphanFiles([{ name: 'x.jpg', modifiedMs: null }], [], NOW)).toEqual(['x.jpg']);
  });
});
