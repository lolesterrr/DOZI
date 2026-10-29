import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { AppDatabase } from '@/db/types';
import { ensureProfile, getProfile, updateProfile } from '@/features/profile/repo';
import { strings } from '@/i18n/strings';
import { createTestDatabase } from '@/test-utils/db';
import { renderWithProviders } from '@/test-utils/render';

import { OnboardingScreen } from '../components/OnboardingScreen';
import { getOnboardingRecord } from '../repo';

let mockDb: AppDatabase;
let mockProfileId = '';
let mockSaved: unknown;

// `mockSaved` is the profile row a re-run starts from.
jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: () => mockDb }));
jest.mock('@/features/profile/hooks', () => ({
  useProfile: () => ({
    profile: mockSaved ?? { id: mockProfileId, timezone: 'Africa/Kampala', dailyGoalXp: 50 },
  }),
}));
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
}));

const s = strings.onboarding;

beforeEach(async () => {
  jest.clearAllMocks();
  mockSaved = undefined;
  mockDb = createTestDatabase();
  mockProfileId = (await ensureProfile(mockDb)).id;
});

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

describe('Onboarding', () => {
  it('walks through every step, saves the answers and goes to Today', async () => {
    await renderWithProviders(<OnboardingScreen />);
    expect(screen.getByText(s.welcomeTitle)).toBeOnTheScreen();
    expect(screen.getByText(strings.disclaimer)).toBeOnTheScreen();

    await press(s.next);
    await press(s.year(3));
    await press(s.semester(2));
    await press(s.next);
    await fireEvent.press(screen.getByRole('radio', { name: new RegExp(s.goals.serious.name) }));
    await press(s.next);
    await press('20:30');
    await press(s.next);
    await fireEvent.press(
      screen.getByRole('radio', { name: new RegExp(s.examPresets.threeMonths) }),
    );
    await press(s.next);
    expect(screen.getByText(s.accountTitle)).toBeOnTheScreen();
    await press(s.finish);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    const profile = await getProfile(mockDb);
    expect(profile).toMatchObject({
      yearOfStudy: 3,
      semester: 2,
      dailyGoalXp: 100,
      reminderTime: '20:30',
    });
    expect(profile?.examDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await getOnboardingRecord(mockDb)).toMatchObject({ skipped: false });
  });

  it('can be skipped, leaving the defaults', async () => {
    await renderWithProviders(<OnboardingScreen />);
    await press(s.skip);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(await getOnboardingRecord(mockDb)).toMatchObject({ skipped: true });
    expect(await getProfile(mockDb)).toMatchObject({ yearOfStudy: null, dailyGoalXp: 50 });
  });

  it('asks for the semester too when only a year is picked', async () => {
    await renderWithProviders(<OnboardingScreen />);
    await press(s.next);
    await press(s.year(2));
    expect(screen.getByText(s.yearBothNeeded)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: s.next })).toBeDisabled();
    await press(s.semester(1));
    expect(screen.getByRole('button', { name: s.next })).toBeEnabled();
  });

  it('re-runs from the saved answers and goes back instead of to Today', async () => {
    await updateProfile(mockDb, mockProfileId, { yearOfStudy: 4, semester: 1, dailyGoalXp: 20 });
    mockSaved = await getProfile(mockDb);

    await renderWithProviders(<OnboardingScreen edit />);
    expect(screen.getByText(s.welcomeEditMessage)).toBeOnTheScreen();
    await press(s.next);
    expect(screen.getByRole('button', { name: s.year(4) })).toBeSelected();
    await press(s.next);
    expect(screen.getByRole('radio', { name: new RegExp(s.goals.casual.name) })).toBeSelected();
    await press(s.next);
    await press(s.reminderNone);
    await press(s.next);
    await press(s.next);
    await press(s.save);
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
    expect(await getProfile(mockDb)).toMatchObject({
      yearOfStudy: 4,
      dailyGoalXp: 20,
      reminderTime: null,
    });
  });
});

describe('onboarding gate', () => {
  it('is needed on a fresh install and done afterwards', async () => {
    expect(await getOnboardingRecord(mockDb)).toBeNull();
    const { skipOnboarding } = jest.requireActual('../repo');
    await skipOnboarding(mockDb);
    expect(await getOnboardingRecord(mockDb)).toMatchObject({ skipped: true });
  });
});
