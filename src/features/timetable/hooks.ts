import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { settings, timetableClasses, type TimetableClass } from '@/db/schema';
import { useProfile } from '@/features/profile/hooks';
import { strings } from '@/i18n/strings';
import { DEFAULT_TIMEZONE, localDate, localTimeOfDay, nowIso } from '@/lib/time';

import { toMinutes, weekdayOf, type ClassDraft, type Moment } from './logic';
import * as repo from './repo';

/** Every timetable, the one in use, and its classes, all kept up to date. */
export function useActiveTimetable() {
  const db = useDatabase();
  const ownerId = useProfile().profile?.id ?? '';
  const list = useLiveQuery(repo.timetableListQuery(db, ownerId), [ownerId]);
  const saved = useLiveQuery(
    db.select().from(settings).where(eq(settings.key, repo.ACTIVE_TIMETABLE_KEY)).limit(1),
  );
  const savedId = useMemo(() => {
    try {
      const value: unknown = JSON.parse(saved.data[0]?.valueJson ?? 'null');
      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  }, [saved.data]);
  const active = repo.pickActive(list.data, savedId);
  const classes = useLiveQuery(repo.classListQuery(db, active?.id ?? ''), [active?.id]);
  return {
    loading: list.updatedAt === undefined,
    timetables: list.data,
    active,
    classes: classes.data as TimetableClass[],
  };
}

/** One class (including a deleted one, so the editor can say it's gone). */
export function useTimetableClass(id: string) {
  const db = useDatabase();
  const { data, updatedAt } = useLiveQuery(
    db.select().from(timetableClasses).where(eq(timetableClasses.id, id)).limit(1),
    [id],
  );
  return { cls: data[0] as TimetableClass | undefined, loading: updatedAt === undefined };
}

/** The weekday and minute of the day now, in the student's timezone, ticking every 30 s. */
export function useNow(): Moment & { time: string } {
  const timeZone = useProfile().profile?.timezone ?? DEFAULT_TIMEZONE;
  const [moment, setMoment] = useState(() => readMoment(timeZone));
  useEffect(() => {
    const timer = setInterval(() => setMoment(readMoment(timeZone)), 30_000);
    return () => clearInterval(timer);
  }, [timeZone]);
  return moment;
}

function readMoment(timeZone: string): Moment & { time: string } {
  const now = nowIso();
  const time = localTimeOfDay(now, timeZone);
  return { weekday: weekdayOf(localDate(now, timeZone)), minutes: toMinutes(time), time };
}

/** Changes to timetables and classes. */
export function useTimetableActions() {
  const db = useDatabase();
  const ownerId = useProfile().profile?.id ?? '';
  return useMemo(
    () => ({
      async addClasses(draft: ClassDraft) {
        const table = await repo.ensureActiveTimetable(db, ownerId, strings.timetable.defaultName);
        return repo.createClasses(db, { ownerId, timetableId: table.id, draft });
      },
      updateClass: (id: string, draft: ClassDraft) => repo.updateClass(db, id, draft),
      deleteClass: (id: string) => repo.deleteClass(db, id),
      restoreClass: (id: string) => repo.restoreClass(db, id),
      async createTimetable(name: string) {
        const created = await repo.createTimetable(db, { ownerId, name });
        await repo.setActiveTimetableId(db, created.id);
        return created;
      },
      renameTimetable: (id: string, name: string) => repo.renameTimetable(db, id, name),
      deleteTimetable: (id: string) => repo.deleteTimetable(db, id),
      setActive: (id: string) => repo.setActiveTimetableId(db, id),
    }),
    [db, ownerId],
  );
}
