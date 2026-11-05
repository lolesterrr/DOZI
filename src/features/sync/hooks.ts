import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useDatabase } from '@/db/DatabaseProvider';
import { useAuthSession } from '@/features/account/auth';
import { useAccountDeletion } from '@/features/account/deletion';
import { deviceMediaTransfer } from '@/features/media/cloud';
import { setMediaCloud } from '@/features/media/transfer';
import { useProfile } from '@/features/profile/hooks';
import { supabase } from '@/lib/supabase';

import { configureSync, getSyncStatus, requestSync, subscribeSyncStatus } from './controller';
import { supabaseTransport } from './engine';
import { getLastSyncedAt } from './repo';

/**
 * Mounted once in the root layout. Syncs while a student is signed in and the phone's study is
 * theirs (adopted, task 3.2): on start, when the app comes back to the foreground, and whenever
 * something asks (`requestSync`, `requestSyncAfterSession`).
 */
export function useSyncLifecycle() {
  const db = useDatabase();
  const { session } = useAuthSession();
  const profileId = useProfile().profile?.id;
  const userId = session?.user.id;
  // Nothing syncs while the account is waiting to be deleted (task 3.6), until it is kept.
  const deletionPending = useAccountDeletion(userId) !== null;
  const ready = !!supabase && !!userId && profileId === userId && !deletionPending;

  useEffect(() => {
    if (!ready || !supabase || !userId) {
      configureSync(null);
      setMediaCloud(null);
      return;
    }
    const client = supabase;
    const media = deviceMediaTransfer(db, client);
    setMediaCloud({ db, deps: media });
    let cancelled = false;
    getLastSyncedAt(db)
      .catch(() => null)
      .then((last) => {
        if (!cancelled)
          configureSync({ db, transport: supabaseTransport(client), ownerId: userId, media }, last);
      });
    return () => {
      cancelled = true;
    };
  }, [db, ready, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestSync();
    });
    return () => subscription.remove();
  }, []);
}

/** The sync status for the Account screen and the Me tile. */
export function useSyncStatus() {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
}
