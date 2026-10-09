import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DatabaseProvider, useDatabase } from '../DatabaseProvider';
import migrations from '../migrations/migrations';
import { profiles } from '../schema';
import { strings } from '@/i18n/strings';
import { createTestDatabase } from '@/test-utils/db';
import { renderWithProviders } from '@/test-utils/render';

function ShowsDatabase() {
  useDatabase();
  return <Text>app ready</Text>;
}

describe('DatabaseProvider', () => {
  it('migrates, creates the profile, then renders the app', async () => {
    const db = createTestDatabase();
    await renderWithProviders(
      <DatabaseProvider setup={async () => db}>
        <ShowsDatabase />
      </DatabaseProvider>,
    );

    expect(await screen.findByText('app ready')).toBeOnTheScreen();
    expect(await db.select().from(profiles)).toHaveLength(1);
  });

  it('shows a retry screen when the database fails, and recovers on retry', async () => {
    const db = createTestDatabase();
    const setup = jest.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(db);

    await renderWithProviders(
      <DatabaseProvider setup={setup}>
        <ShowsDatabase />
      </DatabaseProvider>,
    );

    expect(await screen.findByText(strings.database.errorTitle)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: strings.database.retry }));
    await waitFor(() => expect(screen.getByText('app ready')).toBeOnTheScreen());
  });

  it('bundles every migration for the app', () => {
    // migrations.js is what the app runs on the device; .sql files are inlined by Babel.
    expect(migrations.journal.entries.length).toBeGreaterThan(0);
    for (const entry of migrations.journal.entries) {
      const key = `m${String(entry.idx).padStart(4, '0')}` as keyof typeof migrations.migrations;
      expect(migrations.migrations[key]).toMatch(/CREATE (VIRTUAL )?TABLE/);
    }
  });
});

describe('useDatabase', () => {
  it('explains the mistake when used outside the provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderWithProviders(<ShowsDatabase />)).rejects.toThrow(
      'useDatabase must be used inside <DatabaseProvider>',
    );
  });
});
