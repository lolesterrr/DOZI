import { screen } from '@testing-library/react-native';

import { xpEvents } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { strings } from '@/i18n/strings';
import { addDays, currentStudyDay } from '@/lib/time';
import { createLiveTestDatabase } from '@/test-utils/liveQueries';
import { renderWithProviders } from '@/test-utils/render';

import { XpSummary } from '../components/XpSummary';

let mockDb: AppDatabase;
jest.mock('expo-sqlite', () => jest.requireActual('@/test-utils/liveQueries').expoSqliteMock);
jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: () => mockDb }));
jest.mock('@/features/profile/hooks', () => ({
  useProfile: () => ({
    profile: { id: 'owner-1', timezone: 'Africa/Kampala', dailyGoalXp: 50 },
  }),
}));

const today = currentStudyDay('Africa/Kampala');
const stamp = '2026-10-29T10:00:00.000Z';

async function earn(offset: number, amount: number) {
  await mockDb.insert(xpEvents).values({
    id: `xp-${offset}-${amount}`,
    ownerId: 'owner-1',
    studyDay: addDays(today, offset),
    source: 'lesson_complete',
    sourceId: `l-${offset}`,
    amount,
    createdAt: stamp,
    updatedAt: stamp,
  });
}

beforeEach(() => {
  mockDb = createLiveTestDatabase();
});

describe('XP summary: level, goal and streak', () => {
  it('shows the level, the goal and a streak that includes today', async () => {
    await earn(-2, 20);
    await earn(-1, 20);
    await earn(0, 30);
    await renderWithProviders(<XpSummary />);
    expect(await screen.findByText(strings.streak.label(3))).toBeOnTheScreen();
    expect(screen.getByText(strings.streak.todayDone)).toBeOnTheScreen();
    expect(screen.getByText(strings.streak.longest(3))).toBeOnTheScreen();
    expect(screen.getByText(strings.xp.levelLabel(2, strings.xp.titles.intern))).toBeOnTheScreen();
    expect(screen.getByText(strings.xp.goalProgress(30, 50))).toBeOnTheScreen();
  });

  it('keeps yesterday’s streak and gently says what today needs', async () => {
    await earn(-1, 20);
    await renderWithProviders(<XpSummary />);
    expect(await screen.findByText(strings.streak.label(1))).toBeOnTheScreen();
    expect(screen.getByText(strings.streak.atRisk)).toBeOnTheScreen();
    expect(screen.getByText(strings.streak.freezes(0))).toBeOnTheScreen();
  });

  it('offers a way back after a break, without scolding', async () => {
    await earn(-4, 20);
    await earn(-3, 20);
    await earn(-2, 20);
    // Yesterday is missed and there is no freeze, so the streak is broken; today is day 1 of
    // the 48-hour repair window.
    await earn(0, 20);
    await renderWithProviders(<XpSummary />);
    expect(await screen.findByText(/took a break/)).toBeOnTheScreen();
    expect(screen.getByText(/Earn 80 more XP/)).toBeOnTheScreen();
  });

  it('says how to start when there is no streak yet', async () => {
    await renderWithProviders(<XpSummary />);
    expect(await screen.findByText(strings.streak.none)).toBeOnTheScreen();
    expect(screen.getByText(strings.streak.start)).toBeOnTheScreen();
  });
});
