import type { AppDatabase } from '@/db/types';
import { downloadCloudMedia, type MediaTransferDeps } from '@/features/media/transfer';
import { createLogger } from '@/lib/logger';

import { runSync, type SyncSummary, type SyncTransport } from './engine';
import { backoffDelay, isOfflineError, type SyncPhase } from './logic';

// When sync runs (task 3.3, ARCHITECTURE §4): one run at a time, requests made during a run
// queue one more run, short delays for "after a session" (10 s debounce), and exponential
// backoff after errors (which also covers the network coming back). The UI never waits for it.

const log = createLogger('sync');

export type SyncStatus = {
  phase: SyncPhase;
  /** ISO time of the last successful run (this app session or saved). */
  lastSyncedAt: string | null;
  /** Rows sent and received by the last successful run. */
  lastSummary: SyncSummary | null;
};

type Target = {
  db: AppDatabase;
  transport: SyncTransport;
  ownerId: string;
  /** Image uploads and downloads (task 3.5). */
  media?: MediaTransferDeps;
};

let target: Target | null = null;
let status: SyncStatus = { phase: 'idle', lastSyncedAt: null, lastSummary: null };
const listeners = new Set<() => void>();
let running = false;
let again = false;
let failures = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let timerDue = 0;

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  listeners.forEach((listener) => listener());
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
  timerDue = 0;
}

function schedule(delayMs: number) {
  const due = Date.now() + delayMs;
  // Keep an earlier run that is already planned.
  if (timer && timerDue <= due) return;
  clearTimer();
  timerDue = due;
  timer = setTimeout(() => {
    timer = null;
    timerDue = 0;
    void runNow();
  }, delayMs);
}

async function runNow(): Promise<void> {
  const current = target;
  if (!current) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  again = false;
  setStatus({ phase: 'syncing' });
  try {
    const summary = await runSync(current.db, current.transport, current.ownerId, {
      media: current.media,
    });
    if (target !== current) return; // signed out meanwhile
    failures = 0;
    setStatus({ phase: 'idle', lastSyncedAt: new Date().toISOString(), lastSummary: summary });
    log.info('synced', summary);
    // Images from other phones download in the background; the status doesn't wait for them.
    if (current.media) {
      downloadCloudMedia(current.db, current.ownerId, current.media).catch((error: unknown) =>
        log.warn('image downloads failed', { error: String(error) }),
      );
    }
  } catch (error) {
    if (target !== current) return;
    failures += 1;
    const offline = isOfflineError(error);
    setStatus({ phase: offline ? 'offline' : 'error' });
    log.warn('sync failed', { offline, failures, error: String(error) });
    schedule(backoffDelay(failures));
  } finally {
    running = false;
    if (again && target === current) {
      again = false;
      schedule(0);
    }
  }
}

/**
 * Points sync at the signed-in student, or stops it (null) when nobody is signed in. Starting
 * also runs a first sync straight away (the "app start" trigger).
 */
export function configureSync(next: Target | null, lastSyncedAt: string | null = null) {
  const same = next && target && next.db === target.db && next.ownerId === target.ownerId;
  if (same) return;
  target = next;
  failures = 0;
  clearTimer();
  if (!next) {
    setStatus({ phase: 'idle', lastSyncedAt: null, lastSummary: null });
    return;
  }
  setStatus({ phase: 'idle', lastSyncedAt, lastSummary: null });
  schedule(0);
}

/**
 * Asks for a sync. `delayMs` debounces bursts (e.g. 10 s after a review session). Does nothing
 * when nobody is signed in.
 */
export function requestSync({ delayMs = 0 }: { delayMs?: number } = {}) {
  if (!target) return;
  if (delayMs === 0) failures = 0; // a manual or foreground request skips the backoff wait
  schedule(delayMs);
}

/** "After a session" trigger: a review or quiz just finished. */
export function requestSyncAfterSession() {
  requestSync({ delayMs: 10_000 });
}

/** For tests: forget everything. */
export function resetSyncForTests() {
  clearTimer();
  target = null;
  running = false;
  again = false;
  failures = 0;
  status = { phase: 'idle', lastSyncedAt: null, lastSummary: null };
  listeners.clear();
}
