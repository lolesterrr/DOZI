import {
  backoffDelay,
  columnKind,
  compareServerTimes,
  fromRemote,
  isOfflineError,
  newestCursor,
  normaliseTimestamp,
  pullSince,
  rowKey,
  shouldTakeRemote,
  toRemote,
} from '../logic';
import { SYNC_TABLES } from '../tables';

const spec = (name: string) => {
  const t = SYNC_TABLES.find((x) => x.name === name);
  if (!t) throw new Error(name);
  return t;
};

describe('table specs', () => {
  it('covers every synced table once, with its primary key', () => {
    expect(SYNC_TABLES).toHaveLength(20);
    expect(new Set(SYNC_TABLES.map((t) => t.name)).size).toBe(20);
    expect(spec('item_tags').key).toEqual(['item_type', 'item_id', 'tag_id']);
    expect(spec('card_state').key).toEqual(['card_instance_id']);
    expect(spec('streak_state').key).toEqual(['owner_id']);
    expect(spec('notes').key).toEqual(['id']);
  });

  it('never sends local-only columns', () => {
    const names = SYNC_TABLES.flatMap((t) => t.columns.map((c) => c.remote));
    expect(names).not.toContain('_dirty');
    expect(names).not.toContain('_synced_at');
    expect(names).not.toContain('local_uri');
    expect(names).not.toContain('upload_status');
  });

  it('knows each column’s server type', () => {
    expect(columnKind('content_json', 'SQLiteText')).toBe('json');
    expect(columnKind('updated_at', 'SQLiteText')).toBe('timestamp');
    expect(columnKind('study_day', 'SQLiteText')).toBe('date');
    expect(columnKind('pinned', 'SQLiteBoolean')).toBe('bool');
    expect(columnKind('reps', 'SQLiteInteger')).toBe('number');
    expect(columnKind('title', 'SQLiteText')).toBe('text');
  });
});

describe('converting rows', () => {
  const note = {
    id: 'n1',
    ownerId: 'user-a',
    createdAt: '2026-11-05T10:00:00.000Z',
    updatedAt: '2026-11-05T10:05:00.000Z',
    deletedAt: null,
    folderId: null,
    title: 'SAMPLE note',
    contentJson: '{"type":"doc","content":[]}',
    contentText: '',
    wordCount: 0,
    topicId: null,
    drugId: null,
    pinned: true,
    template: null,
    dirty: true,
    syncedAt: null,
  };

  it('turns a phone row into a server row and back', () => {
    const remote = toRemote(spec('notes'), note);
    expect(remote).toMatchObject({
      id: 'n1',
      owner_id: 'user-a',
      content_json: { type: 'doc', content: [] },
      pinned: true,
      deleted_at: null,
    });
    expect(remote).not.toHaveProperty('_dirty');

    const back = fromRemote(spec('notes'), {
      ...remote,
      updated_at: '2026-11-05T10:05:00.000123+00:00',
      server_updated_at: 'x',
    });
    const { dirty, syncedAt, ...synced } = note;
    void dirty;
    void syncedAt;
    expect(back).toEqual(synced);
  });

  it('keeps day columns as days and media without the phone’s file path', () => {
    expect(fromRemote(spec('xp_events'), { study_day: '2026-11-05', amount: '5' })).toEqual({
      studyDay: '2026-11-05',
      amount: 5,
    });
    const media = toRemote(spec('media'), {
      id: 'm1',
      localUri: 'media/m1.jpg',
      uploadStatus: 'local',
      mime: 'image/jpeg',
    });
    expect(media).toEqual({ id: 'm1', mime: 'image/jpeg' });
  });

  it('builds a key for composite tables', () => {
    expect(rowKey(spec('item_tags'), { item_type: 'note', item_id: 'n1', tag_id: 't1' })).toBe(
      'note|n1|t1',
    );
  });

  it('normalises server timestamps', () => {
    expect(normaliseTimestamp('2026-11-05T10:00:00.123456+00:00')).toBe('2026-11-05T10:00:00.123Z');
    expect(normaliseTimestamp('nonsense')).toBe('nonsense');
  });
});

describe('merge rule', () => {
  it('takes the server row unless the phone has newer unsent changes', () => {
    expect(shouldTakeRemote(undefined, '2026-11-05T10:00:00Z')).toBe(true);
    expect(
      shouldTakeRemote({ updatedAt: '2026-11-05T11:00:00Z', dirty: false }, '2026-11-05T10:00:00Z'),
    ).toBe(true);
    expect(
      shouldTakeRemote({ updatedAt: '2026-11-05T11:00:00Z', dirty: true }, '2026-11-05T10:00:00Z'),
    ).toBe(false);
    expect(
      shouldTakeRemote({ updatedAt: '2026-11-05T10:00:00Z', dirty: true }, '2026-11-05T10:00:00Z'),
    ).toBe(false);
    expect(
      shouldTakeRemote({ updatedAt: '2026-11-05T09:00:00Z', dirty: true }, '2026-11-05T10:00:00Z'),
    ).toBe(true);
  });
});

describe('cursors', () => {
  it('starts a little before the last cursor', () => {
    expect(pullSince(null)).toBeNull();
    expect(pullSince('2026-11-05T10:00:00.000123+00:00')).toBe('2026-11-05T09:58:00.000Z');
  });

  it('keeps the newest server time, microseconds included', () => {
    const rows = [
      { server_updated_at: '2026-11-05T10:00:00.000100+00:00' },
      { server_updated_at: '2026-11-05T10:00:00.000900+00:00' },
      { server_updated_at: '2026-11-05T09:00:00.000000+00:00' },
    ];
    expect(newestCursor(null, rows)).toBe('2026-11-05T10:00:00.000900+00:00');
    expect(newestCursor('2026-11-06T00:00:00+00:00', rows)).toBe('2026-11-06T00:00:00+00:00');
    expect(
      compareServerTimes('2026-11-05T10:00:00.000100+00:00', '2026-11-05T10:00:00.0001+00:00'),
    ).toBe(0);
  });
});

describe('retries', () => {
  it('waits longer after each failure, up to 5 minutes', () => {
    expect(backoffDelay(0)).toBe(0);
    expect(backoffDelay(1)).toBe(5000);
    expect(backoffDelay(2)).toBe(10000);
    expect(backoffDelay(20)).toBe(300000);
  });

  it('tells "no internet" apart from other errors', () => {
    expect(isOfflineError(new TypeError('Network request failed'))).toBe(true);
    expect(isOfflineError(new Error('permission denied for table notes'))).toBe(false);
  });
});
