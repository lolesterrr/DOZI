import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { AppDatabase } from '@/db/types';
import { ensureProfile, getProfile } from '@/features/profile/repo';
import { strings } from '@/i18n/strings';
import { createLiveTestDatabase } from '@/test-utils/liveQueries';
import { renderWithProviders } from '@/test-utils/render';

import { SettingsScreen } from '../components/SettingsScreen';
import { getAppSettings } from '../repo';

// These tests wait on live database updates, which can take a few seconds on a busy machine.
jest.setTimeout(30_000);

let mockDb: AppDatabase;
let mockAlphaExpiresOn: string | null = null;
jest.mock('@/features/alpha/config', () => ({ alphaExpiresOn: () => mockAlphaExpiresOn }));
jest.mock('expo-sqlite', () => jest.requireActual('@/test-utils/liveQueries').expoSqliteMock);
jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: () => mockDb }));
jest.mock('@/features/profile/hooks', () => {
  const { useState, useEffect } = jest.requireActual('react');
  const repo = jest.requireActual('@/features/profile/repo');
  return {
    useProfile: () => {
      const [profile, setProfile] = useState(undefined);
      useEffect(() => {
        // Polls the database, but only re-renders when the profile changed: re-rendering the
        // whole screen every 20 ms starves a slow machine and the tests time out.
        const timer = setInterval(
          () =>
            repo
              .getProfile(mockDb)
              .then((next: unknown) =>
                setProfile((prev: unknown) =>
                  JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
                ),
              ),
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
const mockShareMyData = jest.fn();
jest.mock('@/features/export/device', () => ({
  shareMyData: (...args: unknown[]) => mockShareMyData(...args),
}));
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn() },
}));

const s = strings.settings;

beforeEach(async () => {
  mockAlphaExpiresOn = null;
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
    // Wait until the profile has loaded (the current goal shows as selected): before that the
    // screen has no profile to save to, and a tap does nothing.
    await screen.findByRole('button', {
      name: new RegExp(strings.onboarding.goals.regular.name),
      selected: true,
    });
    await fireEvent.press(
      screen.getByRole('button', { name: new RegExp(strings.onboarding.goals.serious.name) }),
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

  it('saves the student’s name, tidied', async () => {
    await renderWithProviders(<SettingsScreen />);
    await screen.findByRole('button', {
      name: new RegExp(strings.onboarding.goals.regular.name),
      selected: true,
    });
    const field = screen.getByLabelText(s.name);
    await fireEvent.changeText(field, '  Joe   K ');
    await fireEvent(field, 'blur');
    await waitFor(async () => expect((await getProfile(mockDb))?.displayName).toBe('Joe K'));
  });

  it('exports the student’s data and says so', async () => {
    mockShareMyData.mockResolvedValue({
      shared: true,
      summary: { rows: 3, pictures: 2, missingPictures: 0 },
    });
    await renderWithProviders(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: s.exportMyData }));
    expect(await screen.findByText(s.exported(2))).toBeOnTheScreen();
    expect(mockShareMyData).toHaveBeenCalledWith(mockDb, s.exportShareTitle, expect.any(Function));
  });

  it('says when some pictures are only in the backup', async () => {
    mockShareMyData.mockResolvedValue({
      shared: true,
      summary: { rows: 3, pictures: 0, missingPictures: 1 },
    });
    await renderWithProviders(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: s.exportMyData }));
    expect(await screen.findByText(s.exportMissing(1))).toBeOnTheScreen();
  });

  it('shows the storage used', async () => {
    await renderWithProviders(<SettingsScreen />);
    expect(await screen.findByText('2 KB')).toBeOnTheScreen();
  });

  it('links to the known issues, and hides the feedback link until a form is set', async () => {
    await renderWithProviders(<SettingsScreen />);
    expect(await screen.findByRole('link', { name: s.alphaNotes })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: s.privacy })).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: s.sendFeedback })).toBeNull();
  });

  it('says nothing about an expiry in builds that never expire', async () => {
    await renderWithProviders(<SettingsScreen />);
    expect(await screen.findByRole('link', { name: s.alphaNotes })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: s.privacy })).toBeOnTheScreen();
    expect(screen.queryByText(/stops working/)).toBeNull();
  });

  it('says when the alpha stops working', async () => {
    mockAlphaExpiresOn = '2026-11-15';
    await renderWithProviders(<SettingsScreen />);
    expect(
      await screen.findByText(strings.alphaExpiry.settingsLine('Sunday 15 November 2026')),
    ).toBeOnTheScreen();
  });
});
