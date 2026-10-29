import { render, screen } from '@testing-library/react-native';

import { noCelebration } from '@/features/gamification/celebration';
import { strings } from '@/i18n/strings';
import { ThemeProvider } from '@/theme';

import { SessionSummary } from '../components/SessionSummary';

jest.mock('@/features/gamification/components/XpSummary', () => ({ XpSummary: () => null }));

const summary = { cards: 5, remembered: 4, accuracy: 0.8, timeMs: 120000 } as never;
const props = {
  summary,
  mode: 'review' as const,
  nextLearningDue: null,
  now: 0,
  onCheckAgain: jest.fn(),
  onDone: jest.fn(),
};

const renderIt = async (ui: React.ReactElement) =>
  await render(<ThemeProvider initialPreference="light">{ui}</ThemeProvider>);

describe('SessionSummary celebration', () => {
  it('shows the XP earned and the big moments', async () => {
    await renderIt(
      <SessionSummary
        {...props}
        celebration={{
          ...noCelebration,
          xp: 12,
          goalReached: true,
          streakExtended: true,
          streakDays: 3,
        }}
      />,
    );
    expect(screen.getByLabelText('+12 XP')).toBeOnTheScreen();
    expect(screen.getByText(strings.streak.extendedToast(3))).toBeOnTheScreen();
    expect(screen.getByText(strings.xp.goalReachedToast(5))).toBeOnTheScreen();
  });

  it('shows nothing extra when no XP was earned', async () => {
    await renderIt(<SessionSummary {...props} celebration={noCelebration} />);
    expect(screen.queryByTestId('celebration')).toBeNull();
  });
});
