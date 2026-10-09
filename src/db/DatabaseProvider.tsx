import { DatabaseZap } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { EmptyState, Text } from '@/components/ui';
import { ensureProfile } from '@/features/profile/repo';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { migrateAppDatabase, openAppDatabase, type ExpoAppDatabase } from './client';
import type { AppDatabase } from './types';

type Status =
  { state: 'loading' } | { state: 'error'; error: Error } | { state: 'ready'; db: AppDatabase };

const DatabaseContext = createContext<AppDatabase | null>(null);

// Opened once per app run; a retry after an error reuses it.
let appDatabase: ExpoAppDatabase | undefined;

async function openAndMigrate(): Promise<AppDatabase> {
  appDatabase ??= openAppDatabase();
  await migrateAppDatabase(appDatabase);
  return appDatabase;
}

export type DatabaseProviderProps = {
  children: ReactNode;
  /** Opens and migrates the database. Tests pass an in-memory one. */
  setup?: () => Promise<AppDatabase>;
};

/**
 * Opens the local database, runs migrations and makes sure the profile exists, then renders the
 * app. Shows a spinner while that happens and a friendly retry screen if it fails.
 */
export function DatabaseProvider({ children, setup = openAndMigrate }: DatabaseProviderProps) {
  const [status, setStatus] = useState<Status>({ state: 'loading' });

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await setup();
        await ensureProfile(db);
        if (!cancelled) setStatus({ state: 'ready', db });
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        if (!cancelled) setStatus({ state: 'error', error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setup, attempt]);

  const retry = useCallback(() => {
    setStatus({ state: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  if (status.state === 'ready') {
    return <DatabaseContext.Provider value={status.db}>{children}</DatabaseContext.Provider>;
  }
  if (status.state === 'error') return <DatabaseError error={status.error} onRetry={retry} />;
  return <DatabaseLoading />;
}

function DatabaseLoading() {
  const { colors } = useTheme();
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator
        size="large"
        color={colors.primary}
        accessibilityLabel={strings.database.loading}
      />
    </View>
  );
}

function DatabaseError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <View className="flex-1 justify-center bg-background">
      <EmptyState
        icon={DatabaseZap}
        title={strings.database.errorTitle}
        message={strings.database.errorMessage}
        actionLabel={strings.database.retry}
        onAction={onRetry}
      />
      {__DEV__ ? (
        <Text variant="caption" tone="muted" className="px-6 text-center">
          {error.message}
        </Text>
      ) : null}
    </View>
  );
}

/** The local database. Only works inside `DatabaseProvider`. */
export function useDatabase(): AppDatabase {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDatabase must be used inside <DatabaseProvider>');
  return db;
}
