import { act, renderHook } from '@testing-library/react-native';

import type { AppDatabase } from '@/db/types';
import { createTestDatabase } from '@/test-utils/db';

import { useNoteAutosave } from '../hooks';
import { NOTE_XP_MIN_WORDS } from '@/features/gamification/logic';

import { createNote } from '../repo';

// A note earns XP once it is longer than 100 words (PRODUCT_SPEC §8.1), once per note.
let mockDb: AppDatabase;
jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: () => mockDb }));
jest.mock('@/features/profile/hooks', () => ({
  useProfile: () => ({ profile: { id: 'owner-1', timezone: 'Africa/Kampala' } }),
}));
const mockAward = jest.fn(async () => null);
jest.mock('@/features/gamification/hooks', () => ({ useXpActions: () => ({ award: mockAward }) }));

const doc = (words: number) => ({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: Array(words).fill('sample').join(' ') }] },
  ],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDb = createTestDatabase();
});

describe('XP for a long note', () => {
  it('gives XP when the note passes 100 words, and only once', async () => {
    const note = await createNote(mockDb, { ownerId: 'owner-1', title: 'SAMPLE' });
    const { result } = await renderHook(() => useNoteAutosave(note.id));

    await act(async () => {
      result.current.onChange(doc(NOTE_XP_MIN_WORDS));
      await result.current.flush();
    });
    expect(mockAward).not.toHaveBeenCalled(); // exactly 100 words is not more than 100

    await act(async () => {
      result.current.onChange(doc(NOTE_XP_MIN_WORDS + 1));
      await result.current.flush();
    });
    expect(mockAward).toHaveBeenCalledWith({ source: 'note_created', sourceId: note.id });

    await act(async () => {
      result.current.onChange(doc(NOTE_XP_MIN_WORDS + 30));
      await result.current.flush();
    });
    expect(mockAward).toHaveBeenCalledTimes(1);
  });
});
