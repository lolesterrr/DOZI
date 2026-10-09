import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { Note } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

import { NoteScreen } from '../components/NoteScreen';
import { useNote, useNoteActions } from '../hooks';
import { emptyDoc, summariseContent } from '../logic';

const s = strings.notes;

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
}));

jest.mock('../hooks', () => ({
  ...jest.requireActual('../hooks'),
  useNote: jest.fn(),
  useNoteActions: jest.fn(),
  useNoteVersions: () => [],
  useNoteAutosave: () => ({ state: 'saved', onChange: jest.fn(), flush: async () => {} }),
}));
jest.mock('@/features/library/hooks', () => ({
  useFolders: () => [],
  useTags: () => [],
  useItemTagMap: () => new Map(),
  useLibraryActions: () => ({ setItemTags: jest.fn(), createTag: jest.fn() }),
}));
jest.mock('@/features/profile/hooks', () => ({ useProfile: () => ({ profile: undefined }) }));

const mockAddImage = jest.fn();
jest.mock('@/features/media/hooks', () => ({ useAddImage: () => mockAddImage }));

// The real editor is a WebView; this fake records the commands the screen sends it.
const mockEditor = {
  getEditorState: () => ({ canUndo: false, canRedo: false, isBoldActive: false }),
  _subscribeToEditorStateUpdate: () => () => {},
  toggleBold: jest.fn(),
  table: jest.fn(),
  insertMediaImage: jest.fn(),
  setContent: jest.fn(),
  focus: jest.fn(),
};
jest.mock('../editor/NoteEditor', () => ({
  useNoteEditor: () => mockEditor,
  NoteEditorView: () => null,
}));

const note = (overrides: Partial<Note> = {}): Note => ({
  id: 'n1',
  ownerId: 'o',
  folderId: null,
  title: 'SAMPLE note',
  ...summariseContent(emptyDoc()),
  wordCount: 3,
  topicId: null,
  drugId: null,
  pinned: false,
  template: null,
  createdAt: '2026-10-09T10:00:00.000Z',
  updatedAt: '2026-10-09T10:00:00.000Z',
  deletedAt: null,
  dirty: true,
  syncedAt: null,
  ...overrides,
});

function setup(current: Note | null = note()) {
  const actions = {
    setTitle: jest.fn(async () => {}),
    setPinned: jest.fn(async () => {}),
    move: jest.fn(async () => {}),
    delete: jest.fn(async () => '2026-10-09T11:00:00.000Z'),
    restore: jest.fn(async () => {}),
    restoreVersion: jest.fn(),
    discardIfBlank: jest.fn(async () => false),
  };
  jest
    .mocked(useNote)
    .mockReturnValue({ note: current ?? undefined, loading: false } as ReturnType<typeof useNote>);
  jest.mocked(useNoteActions).mockReturnValue(actions as never);
  return actions;
}

beforeEach(() => jest.clearAllMocks());

describe('NoteScreen', () => {
  it('says so when the note is gone', async () => {
    setup(null);
    await renderWithProviders(<NoteScreen id="missing" />);
    expect(screen.getByText(s.missingTitle)).toBeOnTheScreen();
  });

  it('says so when the saved content is damaged', async () => {
    setup(note({ contentJson: '{"type":"nope"}' }));
    await renderWithProviders(<NoteScreen id="n1" />);
    expect(screen.getByText(s.loadErrorTitle)).toBeOnTheScreen();
  });

  it('shows the title, word count and save state, and saves title changes', async () => {
    jest.useFakeTimers();
    const actions = setup();
    await renderWithProviders(<NoteScreen id="n1" />);
    expect(screen.getByDisplayValue('SAMPLE note')).toBeOnTheScreen();
    expect(screen.getByText(`${s.words(3)} · ${s.saveStates.saved}`)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(s.titleLabel), 'Cholinergics');
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(actions.setTitle).toHaveBeenCalledWith('n1', 'Cholinergics');
    jest.useRealTimers();
  });

  it('sends toolbar commands to the editor', async () => {
    setup();
    await renderWithProviders(<NoteScreen id="n1" />);
    await fireEvent.press(screen.getByRole('button', { name: s.toolbar.bold }));
    expect(mockEditor.toggleBold).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: s.toolbar.insertTable }));
    expect(mockEditor.table).toHaveBeenCalledWith('insert');
  });

  it('adds a compressed image as a media:// reference', async () => {
    setup();
    mockAddImage.mockResolvedValue({ status: 'saved', media: { id: 'm1' } });
    await renderWithProviders(<NoteScreen id="n1" />);
    await fireEvent.press(screen.getByRole('button', { name: s.toolbar.image }));
    await fireEvent.press(screen.getByRole('button', { name: s.imageFromGallery }));
    expect(mockAddImage).toHaveBeenCalledWith('library');
    expect(mockEditor.insertMediaImage).toHaveBeenCalledWith('media://m1');
  });

  it('deletes the note, goes back and offers undo', async () => {
    const actions = setup();
    await renderWithProviders(<NoteScreen id="n1" />);
    await fireEvent.press(screen.getByRole('button', { name: s.moreOptions }));
    await fireEvent.press(screen.getByRole('button', { name: s.actions.delete }));
    expect(actions.delete).toHaveBeenCalledWith('n1');
    expect(router.back).toHaveBeenCalled();
    await fireEvent.press(await screen.findByText(strings.library.undo));
    expect(actions.restore).toHaveBeenCalledWith('n1');
  });
});
