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
const mockDeleteMedia = jest.fn(async () => {});
jest.mock('@/features/media/hooks', () => ({
  useAddImage: () => mockAddImage,
  useDeleteMedia: () => mockDeleteMedia,
}));

// The drawing screen has its own tests; here a fake one lets the test save or close it.
jest.mock('@/features/annotation', () => {
  // jest.mock factories can't use the file's imports, so this one requires its own.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text } = require('react-native');
  return {
    ImageAnnotator: ({
      mediaId,
      onClose,
      onSaved,
    }: {
      mediaId: string | null;
      onClose: () => void;
      onSaved: (media: { id: string }) => void;
    }) =>
      mediaId ? (
        <>
          <Text>{`Drawing on ${mediaId}`}</Text>
          <Pressable accessibilityRole="button" onPress={() => onSaved({ id: `${mediaId}-drawn` })}>
            <Text>Save drawing</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose}>
            <Text>Close drawing</Text>
          </Pressable>
        </>
      ) : null,
  };
});

// The real editor is a WebView; this fake records the commands the screen sends it.
const editorState = { canUndo: false, canRedo: false, isBoldActive: false };
const mockEditor = {
  getEditorState: jest.fn((): object => editorState),
  _subscribeToEditorStateUpdate: () => () => {},
  toggleBold: jest.fn(),
  table: jest.fn(),
  insertMediaImage: jest.fn(),
  replaceMediaImage: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockEditor.getEditorState.mockImplementation(() => editorState);
});

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

  it('lets the student draw on a new photo before it goes into the note', async () => {
    setup();
    mockAddImage.mockResolvedValue({ status: 'saved', media: { id: 'm1' } });
    await renderWithProviders(<NoteScreen id="n1" />);
    await fireEvent.press(screen.getByRole('button', { name: s.toolbar.image }));
    await fireEvent.press(screen.getByRole('button', { name: s.imageAnnotateCamera }));
    expect(mockAddImage).toHaveBeenCalledWith('camera');
    expect(screen.getByText('Drawing on m1')).toBeOnTheScreen();
    expect(mockEditor.insertMediaImage).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Save drawing' }));
    expect(mockEditor.insertMediaImage).toHaveBeenCalledWith('media://m1-drawn');
    expect(screen.queryByText('Drawing on m1')).toBeNull();
    // The photo it was drawn on is kept as the original.
    expect(mockDeleteMedia).not.toHaveBeenCalled();
  });

  it('drops the photo again if the drawing is closed without saving', async () => {
    setup();
    mockAddImage.mockResolvedValue({ status: 'saved', media: { id: 'm1' } });
    await renderWithProviders(<NoteScreen id="n1" />);
    await fireEvent.press(screen.getByRole('button', { name: s.toolbar.image }));
    await fireEvent.press(screen.getByRole('button', { name: s.imageAnnotateGallery }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close drawing' }));
    expect(mockDeleteMedia).toHaveBeenCalledWith('m1');
    expect(mockEditor.insertMediaImage).not.toHaveBeenCalled();
  });

  it('draws on an image already in the note and swaps in the annotated copy', async () => {
    setup();
    const selectedImage = { ref: 'media://m7', pos: 12 };
    mockEditor.getEditorState.mockImplementation(() => ({ ...editorState, selectedImage }));
    await renderWithProviders(<NoteScreen id="n1" />);
    await fireEvent.press(screen.getByText(s.toolbar.annotateImage));
    expect(screen.getByText('Drawing on m7')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save drawing' }));
    expect(mockEditor.replaceMediaImage).toHaveBeenCalledWith(selectedImage, 'media://m7-drawn');
    expect(mockEditor.insertMediaImage).not.toHaveBeenCalled();

    // Closing without saving never deletes an image that was already in the note.
    await fireEvent.press(screen.getByText(s.toolbar.annotateImage));
    await fireEvent.press(screen.getByRole('button', { name: 'Close drawing' }));
    expect(mockDeleteMedia).not.toHaveBeenCalled();
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
