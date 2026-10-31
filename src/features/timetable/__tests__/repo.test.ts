import { createTestDatabase } from '@/test-utils/db';

import { emptyDraft, type ClassDraft } from '../logic';
import {
  createClasses,
  createTimetable,
  deleteClass,
  deleteTimetable,
  ensureActiveTimetable,
  getActiveTimetableId,
  getClass,
  listClasses,
  listTimetables,
  pickActive,
  renameTimetable,
  restoreClass,
  setActiveTimetableId,
  updateClass,
} from '../repo';

// SAMPLE timetable for tests only: made-up course names.
const owner = 'owner-1';
let ids = 0;
const deps = { newId: () => `id-${++ids}`, now: () => '2026-10-31T10:00:00.000Z' };

const draft = (changes: Partial<ClassDraft> = {}): ClassDraft => ({
  ...emptyDraft(1),
  title: 'SAMPLE course',
  ...changes,
});

describe('timetable repo', () => {
  it('makes a first timetable when a class is added, and sets it in use', async () => {
    const db = createTestDatabase();
    const table = await ensureActiveTimetable(db, owner, 'My timetable', deps);
    expect(table.name).toBe('My timetable');
    expect(await getActiveTimetableId(db)).toBe(table.id);
    // A second call reuses it.
    expect((await ensureActiveTimetable(db, owner, 'Other', deps)).id).toBe(table.id);
  });

  it('adds one row per chosen day, with the reminders saved as JSON', async () => {
    const db = createTestDatabase();
    const table = await createTimetable(db, { ownerId: owner, name: 'SAMPLE' }, deps);
    const rows = await createClasses(
      db,
      { ownerId: owner, timetableId: table.id, draft: draft({ weekdays: [3, 1] }) },
      deps,
    );
    expect(rows.map((r) => r.weekday)).toEqual([1, 3]);
    expect(JSON.parse(rows[0].remindersJson)).toEqual([{ type: 'before', minutes: 30 }]);
    expect(rows[0].dirty).toBe(true);
  });

  it('refuses a class that can’t be saved', async () => {
    const db = createTestDatabase();
    await expect(
      createClasses(db, { ownerId: owner, timetableId: 't', draft: draft({ title: '' }) }, deps),
    ).rejects.toThrow();
  });

  it('updates, deletes and restores a class', async () => {
    const db = createTestDatabase();
    const [row] = await createClasses(
      db,
      { ownerId: owner, timetableId: 't', draft: draft() },
      deps,
    );
    await updateClass(db, row.id, draft({ title: 'SAMPLE renamed', weekdays: [5] }), deps);
    expect(await getClass(db, row.id)).toMatchObject({ title: 'SAMPLE renamed', weekday: 5 });
    await deleteClass(db, row.id, deps);
    expect(await listClasses(db, 't')).toEqual([]);
    await restoreClass(db, row.id, deps);
    expect(await listClasses(db, 't')).toHaveLength(1);
  });

  it('renames and deletes a timetable with its classes', async () => {
    const db = createTestDatabase();
    const a = await createTimetable(db, { ownerId: owner, name: 'A' }, deps);
    const b = await createTimetable(db, { ownerId: owner, name: 'B' }, deps);
    await createClasses(db, { ownerId: owner, timetableId: a.id, draft: draft() }, deps);
    await renameTimetable(db, a.id, '  Year 2   Sem 1 ', deps);
    expect((await listTimetables(db, owner))[0].name).toBe('Year 2 Sem 1');
    await setActiveTimetableId(db, a.id);
    await deleteTimetable(db, a.id, deps);
    const left = await listTimetables(db, owner);
    expect(left.map((t) => t.id)).toEqual([b.id]);
    expect(await listClasses(db, a.id)).toEqual([]);
    // The saved id now points at a deleted timetable, so the oldest live one is used.
    expect(pickActive(left, await getActiveTimetableId(db))?.id).toBe(b.id);
  });
});
