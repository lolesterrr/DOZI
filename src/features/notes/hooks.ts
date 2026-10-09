import { desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useDatabase } from '@/db/DatabaseProvider';
import { noteVersions, notes } from '@/db/schema';
import { useProfile } from '@/features/profile/hooks';
import { createLogger } from '@/lib/logger';

import { AUTOSAVE_DELAY_MS, toNoteDoc, type DocNode, type SaveState } from './logic';
import * as repo from './repo';

const log = createLogger('notes');

/** One note, kept up to date (including a deleted one, so the screen can say it's gone). */
export function useNote(id: string) {
  const db = useDatabase();
  const { data, updatedAt } = useLiveQuery(
    db.select().from(notes).where(eq(notes.id, id)).limit(1),
    [id],
  );
  return { note: data[0], loading: updatedAt === undefined };
}

/** A note's earlier versions, newest first. */
export function useNoteVersions(noteId: string) {
  const db = useDatabase();
  const { data } = useLiveQuery(
    db
      .select()
      .from(noteVersions)
      .where(eq(noteVersions.noteId, noteId))
      .orderBy(desc(noteVersions.createdAt), desc(noteVersions.id)),
    [noteId],
  );
  return data;
}

/** Note changes, bound to the database and the profile. */
export function useNoteActions() {
  const db = useDatabase();
  const ownerId = useProfile().profile?.id ?? '';
  return useMemo(
    () => ({
      create: (folderId: string | null) => repo.createNote(db, { ownerId, folderId }),
      saveContent: (id: string, doc: DocNode) => repo.saveNoteContent(db, id, doc),
      setTitle: (id: string, title: string) => repo.setNoteTitle(db, id, title),
      setPinned: (id: string, pinned: boolean) => repo.setNotePinned(db, id, pinned),
      move: (id: string, folderId: string | null) => repo.moveNote(db, id, folderId),
      delete: (id: string) => repo.deleteNote(db, id),
      restore: (id: string) => repo.restoreNote(db, id),
      restoreVersion: (id: string, versionId: string) => repo.restoreNoteVersion(db, id, versionId),
      discardIfBlank: (id: string) => repo.discardIfBlank(db, id),
    }),
    [db, ownerId],
  );
}

/**
 * Saves a value a short while after it stops changing (autosave). Saves run one at a time, in
 * order. Anything waiting is saved straight away when the app goes to the background or the
 * screen closes. `flush()` saves now and resolves once every save so far has finished.
 */
export function useDebouncedSave<T>(save: (value: T) => Promise<unknown>, delayMs: number) {
  const [state, setState] = useState<SaveState>('saved');
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback((): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
    const next = pending.current;
    pending.current = null;
    if (next) {
      queue.current = queue.current.then(async () => {
        setState('saving');
        try {
          await saveRef.current(next.value);
          setState(pending.current ? 'unsaved' : 'saved');
        } catch (error) {
          log.warn('Autosave failed', { error: String(error) });
          // Keep it so the next change or flush tries again.
          pending.current ??= next;
          setState('error');
        }
      });
    }
    return queue.current;
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      setState('unsaved');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delayMs);
    },
    [delayMs, flush],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState !== 'active') void flush();
    });
    return () => {
      subscription.remove();
      void flush();
    };
  }, [flush]);

  return { state, schedule, flush };
}

/** Autosave for a note body. `onChange` takes what the editor sends and checks it first. */
export function useNoteAutosave(noteId: string) {
  const actions = useNoteActions();
  const save = useCallback((doc: DocNode) => actions.saveContent(noteId, doc), [actions, noteId]);
  const { state, schedule, flush } = useDebouncedSave(save, AUTOSAVE_DELAY_MS);
  const onChange = useCallback(
    (value: unknown) => {
      const doc = toNoteDoc(value);
      if (doc) schedule(doc);
      else log.warn('Ignored editor content that is not a note body');
    },
    [schedule],
  );
  return { state, onChange, flush };
}
