import { useSyncExternalStore } from 'react';

import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// Whether the signed-in account is waiting to be deleted (task 3.6: deleting can be undone for
// 10 days; supabase/migrations/20261105100000_account_deletion_grace.sql). Shared by the Account
// screen and sync, which pauses while a deletion is pending.

const log = createLogger('account');

export type DeletionState = {
  /** The account this is about. */
  userId: string | null;
  /** When the account will be deleted (ISO), or null when it isn't going to be. */
  purgeAfter: string | null;
};

let state: DeletionState = { userId: null, purgeAfter: null };
const listeners = new Set<() => void>();

function setState(next: DeletionState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getDeletionState(): DeletionState {
  return state;
}

export function subscribeDeletion(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The pending deletion date for this account, or null. */
export function useAccountDeletion(userId: string | undefined): string | null {
  const current = useSyncExternalStore(subscribeDeletion, getDeletionState);
  return userId && current.userId === userId ? current.purgeAfter : null;
}

export function setDeletionPending(userId: string | null, purgeAfter: string | null) {
  setState({ userId, purgeAfter });
}

/** Asks the server whether this account is waiting to be deleted. Offline, nothing changes. */
export async function refreshDeletionStatus(userId: string): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase.rpc('account_deletion_status');
  if (error) {
    log.warn('could not check the deletion status', { error: error.message });
    return;
  }
  setState({ userId, purgeAfter: typeof data === 'string' ? data : null });
}

/** For tests. */
export function resetDeletionForTests() {
  state = { userId: null, purgeAfter: null };
  listeners.clear();
}
