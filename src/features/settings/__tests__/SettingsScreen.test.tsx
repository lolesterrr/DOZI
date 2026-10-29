import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { AppDatabase } from '@/db/types';
import { ensureProfile, getProfile } from '@/features/profile/repo';
import { strings } from '@/i18n/strings';
import { createLiveTestDatabase } from '@/test-utils/liveQueries';
import { renderWithProviders } from '@/test-utils/render';

import { SettingsScreen } from '../components/SettingsScreen';
import { getAppSettings } from '../repo';

let mockDb: AppDatabase;
jest.mock('expo-sqlite', () => jest.requireActual('@/test-utils/liveQueries').expoSqliteMock);
jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: () => mockDb }));
jest.mock('@/features/profile/hooks', () => {
  const { useState, useEffect } = jest.requireActual('react');
  return {
    useProfile: () => {
      const [profile, setProfile] = useState(undefined);
      useEffect(() => {
        const timer = setInterval(
          () => jest.requireActual('@/features/profile/repo').getProfile(mockDb).then(setProfile),
          20,
        );
        return () => clearInterval(timer);
      }, []);
      return { profile };
    },
  };
});
jest.mock('@/features/media/hooks', () => ({
  useStorageUsed: () => 2048,
  useCleanUpNow: () => async () => 0,
}));
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn() },
}));

const s = strings.settings;

beforeEach(async () => {
  mockDb = createLiveTestDatabase();
  await ensureProfile(mockDb);
});

describe('Settings screen', () => {
  it('saves the theme and a notification toggle', async () => {
    await renderWithProviders(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: s.themes.dark }));
    await waitFor(async () => expect((await getAppSettings(mockDb)).theme).toBe('dark'));

    await fireEvent(screen.getByLabelText(s.toggleStreak), 'valueChange', false);
    await waitFor(async () =>
      expect((await getAppSettings(mockDb)).notifications.streak).toBe(false),
    );
    expect((await getAppSettings(mockDb)).notifications.daily).toBe(true);
  });

  it('saves the daily goal and the reminder time on the profile', async () => {
    await renderWithProviders(<SettingsScreen />);
    await fireEvent.press(
      await screen.findByRole('button', {
        name: new RegExp(strings.onboarding.goals.serious.name),
      }),
    );
    await waitFor(async () => expect((await getProfile(mockDb))?.dailyGoalXp).toBe(100));
    await fireEvent.press(screen.getByRole('button', { name: '20:30' }));
    await waitFor(async () => expect((await getProfile(mockDb))?.reminderTime).toBe('20:30'));
  });

  it('hides the reminder times when the daily reminder is off, and offers the permission prompt', async () => {
    await renderWithProviders(<SettingsScreen />);
    expect(await screen.findByRole('button', { name: s.allow })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '19:00' })).toBeOnTheScreen();
    await fireEvent(screen.getByLabelText(s.toggleDaily), 'valueChange', false);
    await waitFor(() => expect(screen.queryByRole('button', { name: '19:00' })).toBeNull());
  });

  it('shows the storage used', async () => {
    await renderWithProviders(<SettingsScreen />);
    expect(await screen.findByText('2 KB')).toBeOnTheScreen();
  });

  it('links to the known issues, and hides the feedback link until a form is set', async () => {
    await renderWithProviders(<SettingsScreen />);
    expect(await screen.findByRole('link', { name: s.alphaNotes })).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: s.sendFeedback })).toBeNull();
  });
});
