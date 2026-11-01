import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

import { ClassEditorScreen } from '../components/ClassEditorScreen';

// SAMPLE timetable for tests only: made-up course names.
const s = strings.timetable;

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'new', weekday: '2' }),
}));
const mockActions = {
  addClasses: jest.fn(async () => [{ id: 'x' }]),
  updateClass: jest.fn(async () => {}),
  deleteClass: jest.fn(async () => {}),
  restoreClass: jest.fn(async () => {}),
};
jest.mock('../hooks', () => ({
  useActiveTimetable: () => ({ classes: [], timetables: [], active: undefined, loading: false }),
  useTimetableClass: () => ({ cls: undefined, loading: false }),
  useTimetableActions: () => mockActions,
}));
jest.mock('@/features/notifications', () => ({
  useNotificationPermission: () => ({ state: 'granted', ask: jest.fn() }),
}));
jest.mock('@/features/settings/hooks', () => ({
  useAppSettings: () => ({
    loading: false,
    settings: { notifications: { lectures: true } },
    update: jest.fn(),
  }),
}));

beforeEach(() => jest.clearAllMocks());

describe('class editor', () => {
  it('won’t save a class without a name', async () => {
    await renderWithProviders(<ClassEditorScreen />);
    await fireEvent.press(screen.getByRole('button', { name: s.save }));
    expect(await screen.findByText(s.problems.title)).toBeOnTheScreen();
    expect(mockActions.addClasses).not.toHaveBeenCalled();
  });

  it('adds a class on the chosen days with its reminders', async () => {
    await renderWithProviders(<ClassEditorScreen />);
    await fireEvent.changeText(screen.getByLabelText(s.courseName), 'SAMPLE course');
    await fireEvent.press(screen.getByLabelText('Thursday'));
    await fireEvent.press(
      screen.getByRole('button', { name: s.reminderLabel({ type: 'before', minutes: 10 }) }),
    );
    // Tuesday 08:00, 10 min before → sends Tuesday at 07:50 (shown only for a single day).
    await fireEvent.press(screen.getByLabelText('Thursday'));
    expect(screen.getByText(s.reminderSends('Tuesday', '07:50'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Friday'));
    await fireEvent.press(screen.getByRole('button', { name: s.save }));
    await waitFor(() => expect(mockActions.addClasses).toHaveBeenCalledTimes(1));
    expect(mockActions.addClasses).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'SAMPLE course',
        weekdays: [2, 5],
        reminders: [
          { type: 'before', minutes: 30 },
          { type: 'before', minutes: 10 },
        ],
      }),
    );
  });

  it('shows when a reminder lands in quiet hours', async () => {
    await renderWithProviders(<ClassEditorScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: s.reminderLabel({ type: 'before', minutes: 120 }) }),
    );
    expect(screen.getByText(s.reminderShifted)).toBeOnTheScreen();
  });
});
