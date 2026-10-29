import { render, screen } from '@testing-library/react-native';

import { strings } from '@/i18n/strings';
import { ThemeProvider } from '@/theme';

import { achievementProgress, noStats } from '../achievements';
import { AchievementGallery } from '../components/AchievementGallery';

const entries = achievementProgress({ ...noStats, notesCreated: 4, longestStreak: 7 }).map((p) => ({
  ...p,
  unlockedAt: p.key === 'week_warrior' ? '2026-10-20T10:00:00.000Z' : null,
}));

jest.mock('../hooks', () => ({
  useAchievements: () => ({ loading: false, entries: mockEntries }),
}));
let mockEntries: typeof entries = [];

describe('AchievementGallery', () => {
  it('shows earned badges with a date and locked ones with their hint and progress', async () => {
    mockEntries = entries;
    await render(
      <ThemeProvider initialPreference="light">
        <AchievementGallery />
      </ThemeProvider>,
    );
    expect(screen.getByText(strings.achievements.count(1, 15))).toBeOnTheScreen();
    const earned = screen.getByTestId('badge-week_warrior');
    expect(earned.props.accessibilityLabel).toContain(strings.achievements.earned);
    expect(earned.props.accessibilityLabel).toContain('20 Oct 2026');
    const locked = screen.getByTestId('badge-note_taker');
    expect(locked.props.accessibilityLabel).toContain(strings.achievements.locked);
    expect(locked.props.accessibilityLabel).toContain(strings.achievements.items.note_taker.hint);
    expect(locked.props.accessibilityLabel).toContain(strings.achievements.progress(4, 10));
    expect(screen.getAllByText(strings.achievements.comingLater).length).toBeGreaterThan(0);
  });
});
