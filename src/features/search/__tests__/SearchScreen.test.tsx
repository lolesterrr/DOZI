import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useNoteSearch } from '@/features/notes/hooks';
import { MATCH_END, MATCH_START, type DocNode } from '@/features/notes/logic';
import { createNote } from '@/features/notes/repo';
import { strings } from '@/i18n/strings';
import { createTestDatabase } from '@/test-utils/db';
import { renderWithProviders } from '@/test-utils/render';

import { SearchScreen } from '../components/SearchScreen';

// SAMPLE content for tests only — not reviewed pharmacology.
const s = strings.search;
const mockDb = createTestDatabase();

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn() },
}));
jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: () => mockDb }));
jest.mock('@/features/profile/hooks', () => ({
  useProfile: () => ({ profile: { id: 'owner-1' } }),
}));

const doc = (text: string): DocNode => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

beforeAll(async () => {
  await createNote(mockDb, {
    ownerId: 'owner-1',
    title: 'Week 3',
    content: doc('Draw the receptor diagram'),
  });
  await createNote(mockDb, {
    ownerId: 'owner-1',
    title: '',
    content: doc('A receptor note with no title'),
  });
});

describe('useNoteSearch', () => {
  it('is empty until something is typed, then returns marked results', async () => {
    const { result, rerender } = await renderHook(
      ({ input }: { input: string }) => useNoteSearch(input),
      {
        initialProps: { input: '' },
      },
    );
    expect(result.current.results).toBeNull();
    await rerender({ input: 'diagram' });
    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(result.current.results?.[0].snippet).toContain(`${MATCH_START}diagram${MATCH_END}`);
  });
});

describe('SearchScreen', () => {
  it('shows a hint, then matching notes with the word marked, and opens one', async () => {
    await renderWithProviders(<SearchScreen />);
    expect(screen.getByText(s.hintTitle)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(s.inputLabel), 'receptor');
    expect(await screen.findByText(s.resultCount(2))).toBeOnTheScreen();
    expect(screen.getAllByText('receptor')).toHaveLength(2);
    // A note with no title is still findable.
    expect(screen.getByText(strings.notes.untitled)).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Week 3'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/note/[id]',
      params: { id: expect.any(String) },
    });
  });

  it('says so kindly when nothing matches, and clears', async () => {
    await renderWithProviders(<SearchScreen />);
    await fireEvent.changeText(screen.getByLabelText(s.inputLabel), 'zzzz');
    expect(await screen.findByText(s.noResultsTitle('zzzz'))).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(screen.getByLabelText(s.clear));
    });
    expect(screen.getByText(s.hintTitle)).toBeOnTheScreen();
  });
});
