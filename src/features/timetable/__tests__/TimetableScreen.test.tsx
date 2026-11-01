import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { TimetableClass } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

import { TimetableScreen } from '../components/TimetableScreen';
import { useActiveTimetable } from '../hooks';

// SAMPLE timetable for tests only: made-up course names.
const s = strings.timetable;

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
}));
jest.mock('../hooks', () => ({
  useActiveTimetable: jest.fn(),
  // Monday 09:00
  useNow: () => ({ weekday: 1, minutes: 9 * 60, time: '09:00' }),
  useTimetableActions: () => ({}),
}));

const row = (id: string, weekday: number, startTime: string, endTime: string) =>
  ({
    id,
    title: `SAMPLE course ${id}`,
    code: `SMP ${id}`,
    kind: 'lecture',
    weekday,
    startTime,
    endTime,
    location: 'SAMPLE hall',
    lecturer: '',
    colour: 'blue',
    remindersJson: '[{"type":"before","minutes":30}]',
    deletedAt: null,
  }) as TimetableClass;

const table = { id: 't1', name: 'SAMPLE semester' };

beforeEach(() => jest.clearAllMocks());

describe('timetable screen', () => {
  it('invites the student to add a first class', async () => {
    jest.mocked(useActiveTimetable).mockReturnValue({
      loading: false,
      timetables: [],
      active: undefined,
      classes: [],
    } as never);
    await renderWithProviders(<TimetableScreen />);
    expect(screen.getByText(s.emptyTitle)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: s.addClass }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/timetable/class/[id]',
      params: { id: 'new', weekday: '1' },
    });
  });

  it('shows the class on now, today’s timeline, and opens a class to edit', async () => {
    jest.mocked(useActiveTimetable).mockReturnValue({
      loading: false,
      timetables: [table],
      active: table,
      classes: [
        row('A', 1, '08:00', '10:00'),
        row('B', 1, '14:00', '15:00'),
        row('C', 3, '11:00', '12:00'),
      ],
    } as never);
    await renderWithProviders(<TimetableScreen />);
    expect(screen.getByText('SAMPLE semester')).toBeOnTheScreen();
    expect(screen.getByText(s.nowUntil('10:00', 60))).toBeOnTheScreen();
    expect(screen.getByText('SAMPLE course B')).toBeOnTheScreen();
    expect(screen.queryByText('SAMPLE course C')).toBeNull();
    // A free gap between the two Monday classes.
    expect(screen.getByText(s.free(s.hours(240)))).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByLabelText(s.classLabel('SAMPLE course B', '14:00 – 15:00', 'SAMPLE hall')),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/timetable/class/[id]',
      params: { id: 'B' },
    });
  });

  it('switches days and to the week grid', async () => {
    jest.mocked(useActiveTimetable).mockReturnValue({
      loading: false,
      timetables: [table],
      active: table,
      classes: [row('A', 1, '08:00', '10:00'), row('C', 3, '11:00', '12:00')],
    } as never);
    await renderWithProviders(<TimetableScreen />);
    await fireEvent.press(screen.getByLabelText(s.dayLabel('Wednesday', 1, false)));
    expect(screen.getByText('SAMPLE course C')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText(s.dayLabel('Tuesday', 0, false)));
    expect(screen.getByText(s.freeDay('Tuesday'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText(s.viewLabel(s.viewWeek)));
    expect(screen.getByText('Mon')).toBeOnTheScreen();
    expect(screen.getByText('Fri')).toBeOnTheScreen();
  });
});
