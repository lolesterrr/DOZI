import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { Note } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { openCardEditor } from '@/features/decks/navigation';
import { renderWithProviders } from '@/test-utils/render';

import { NoteScreen } from '../components/NoteScreen';
import { useNote, useNoteActions } from '../hooks';
import { emptyDoc, summariseContent, type DocNode } from '../logic';

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
  useNoteCards: () => mockNoteCards,
  useNoteAutosave: () => ({ state: 'saved', onChange: jest.fn(), flush: async () => {} }),
}));
const mockTransfer = { exportNotePdf: jest.fn(async () => ({ status: 'shared', notes: [] })) };
jest.mock('@/features/export/hooks', () => ({ useTransferActions: () => mockTransfer }));
jest.mock('@/features/library/hooks', () => ({
  useFolders: () => [],
  useTags: () => [],
  useItemTagMap: () => new Map(),
  useLibraryActions: () => ({ setItemTags: jest.fn(), createTag: jest.fn() }),
}));
let mockNoteCards: {
  cards: { frontText: string; backText: string }[];
  loaded: boolean;
} = { cards: [], loaded: true };
const mockDeckActions = {
  createDeck: jest.fn(async () => ({ id: 'd-new' })),
  createCard: jest.fn(async () => ({ id: 'c-new' })),
};
const mockDecks = [
  { id: 'd1', title: 'SAMPLE deck A' },
  { id: 'd2', title: 'SAMPLE deck B' },
];
jest.mock('@/features/decks/hooks', () => ({
  useDecks: () => mockDecks,
  useDeckActions: () => mockDeckActions,
}));
jest.mock('@/features/decks/navigation', () => ({ openCardEditor: jest.fn() }));
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
  mockNoteCards = { cards: [], loaded: true };
});

const heading = (value: string): DocNode => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [{ type: 'text', text: value }],
});
const para = (value: string): DocNode => ({
  type: 'paragraph',
  content: [{ type: 'text', text: value }],
});
const twoPointDoc: DocNode = {
  type: 'doc',
  content: [
    heading('SAMPLE first part'),
    para('Alpha beta gamma delta.'),
    heading('SAMPLE layers'),
    {
      type: 'bulletList',
      content: ['Physical', 'Data link', 'Network'].map((item) => ({
        type: 'listItem',
        content: [para(item)],
      })),
    },
  ],
};

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

  it('exports the note as a PDF from the menu', async () => {
    setup();
    await renderWithProviders(<NoteScreen id="n1" />);
    await fireEvent.press(screen.getByRole('button', { name: s.moreOptions }));
    await fireEvent.press(screen.getByRole('button', { name: strings.transfer.exportPdf }));
    expect(await screen.findByText(strings.transfer.preparing)).toBeOnTheScreen();
    await waitFor(() =>
      expect(mockTransfer.exportNotePdf).toHaveBeenCalledWith('n1', 'SAMPLE note'),
    );
  });

  describe('make card from selected text', () => {
    // SAMPLE words only, no drug facts.
    const noteSelection = { text: 'word', before: 'SAMPLE ', after: ' here.' };

    it('hides the selected words in their sentence and opens the card editor', async () => {
      setup();
      mockEditor.getEditorState.mockImplementation(() => ({ ...editorState, noteSelection }));
      await renderWithProviders(<NoteScreen id="n1" />);
      await fireEvent.press(screen.getByRole('button', { name: s.toolbar.makeCardTypes.cloze }));
      expect(screen.getByText(s.makeCard.title(s.toolbar.makeCardTypes.cloze))).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'SAMPLE deck B' }));
      expect(openCardEditor).toHaveBeenCalledWith('d2', 'new', {
        noteId: 'n1',
        type: 'cloze',
        text: 'SAMPLE {{c1::word}} here.',
      });

      // The deck used last comes first next time.
      await fireEvent.press(screen.getByRole('button', { name: s.toolbar.makeCardTypes.basic }));
      const labels = screen
        .getAllByRole('button')
        .map((button) => button.props.accessibilityLabel as string | undefined);
      expect(labels.indexOf(s.makeCard.lastUsed('SAMPLE deck B'))).toBeLessThan(
        labels.indexOf('SAMPLE deck A'),
      );
    });

    it('can put the card in a new deck named after the note', async () => {
      setup();
      mockEditor.getEditorState.mockImplementation(() => ({ ...editorState, noteSelection }));
      await renderWithProviders(<NoteScreen id="n1" />);
      await fireEvent.press(screen.getByRole('button', { name: s.toolbar.makeCardTypes.basic }));
      await fireEvent.press(
        screen.getByRole('button', { name: s.makeCard.newDeck('SAMPLE note') }),
      );
      expect(mockDeckActions.createDeck).toHaveBeenCalledWith('SAMPLE note');
      await waitFor(() =>
        expect(openCardEditor).toHaveBeenCalledWith('d-new', 'new', {
          noteId: 'n1',
          type: 'basic',
          text: 'word',
        }),
      );
    });

    it('shows no card buttons while nothing is selected', async () => {
      setup();
      await renderWithProviders(<NoteScreen id="n1" />);
      expect(screen.queryByRole('button', { name: s.toolbar.makeCardTypes.cloze })).toBeNull();
    });
  });

  describe('key points', () => {
    it('shows how many key points are in cards and lists them', async () => {
      setup(note({ ...summariseContent(twoPointDoc) }));
      mockNoteCards = {
        cards: [{ frontText: 'Alpha beta gamma delta', backText: '' }],
        loaded: true,
      };
      await renderWithProviders(<NoteScreen id="n1" />);
      await fireEvent.press(screen.getByRole('button', { name: s.keyPoints.meter(1, 2) }));
      expect(screen.getByLabelText(s.keyPoints.covered('SAMPLE first part'))).toBeOnTheScreen();
      expect(screen.getByLabelText(s.keyPoints.notCovered('SAMPLE layers'))).toBeOnTheScreen();
    });

    it('celebrates when the last key point goes into a card', async () => {
      setup(note({ ...summariseContent(twoPointDoc) }));
      mockNoteCards = {
        cards: [{ frontText: 'Alpha beta gamma delta', backText: '' }],
        loaded: true,
      };
      await renderWithProviders(<NoteScreen id="n1" />);
      expect(screen.queryByText(s.keyPoints.earnedTitle)).toBeNull();

      // A new card arrives (the screen redraws when the menu opens).
      mockNoteCards = {
        cards: [...mockNoteCards.cards, { frontText: 'Layers?', backText: 'Physical, data link' }],
        loaded: true,
      };
      await fireEvent.press(screen.getByRole('button', { name: s.moreOptions }));
      expect(await screen.findByText(s.keyPoints.earnedTitle)).toBeOnTheScreen();
      expect(screen.getByText(s.keyPoints.earnedCards(2))).toBeOnTheScreen();
    });

    it("doesn't celebrate a note that was already finished when it opened", async () => {
      setup(note({ ...summariseContent(twoPointDoc) }));
      mockNoteCards = { cards: [], loaded: false };
      await renderWithProviders(<NoteScreen id="n1" />);
      mockNoteCards = {
        cards: [
          { frontText: 'Alpha beta gamma delta', backText: '' },
          { frontText: 'Layers?', backText: 'Physical, data link' },
        ],
        loaded: true,
      };
      await fireEvent.press(screen.getByRole('button', { name: s.moreOptions }));
      expect(screen.getByRole('button', { name: s.keyPoints.meter(2, 2) })).toBeOnTheScreen();
      expect(screen.queryByText(s.keyPoints.earnedTitle)).toBeNull();
    });
  });

  describe('mnemonic maker', () => {
    it('builds a phrase from a list in the note, adds it to the note and makes 2 cards', async () => {
      setup(note({ ...summariseContent(twoPointDoc) }));
      await renderWithProviders(<NoteScreen id="n1" />);
      await fireEvent.press(screen.getByRole('button', { name: s.moreOptions }));
      await fireEvent.press(screen.getByRole('button', { name: s.mnemonic.action }));

      const save = () => screen.getByRole('button', { name: s.mnemonic.save });
      expect(save()).toBeDisabled();
      await fireEvent.press(
        screen.getByRole('button', { name: s.mnemonic.useList('Physical', 3) }),
      );
      await fireEvent.changeText(screen.getByLabelText(s.mnemonic.phraseLabel), 'Please do eat');
      expect(screen.getByLabelText(s.mnemonic.letterWrong('N', 'eat'))).toBeOnTheScreen();
      expect(save()).toBeDisabled();

      await fireEvent.changeText(screen.getByLabelText(s.mnemonic.phraseLabel), 'Please do not');
      expect(screen.getByLabelText(s.mnemonic.letterOk('N', 'not'))).toBeOnTheScreen();
      await fireEvent.press(save());

      expect(screen.getByText(s.mnemonic.deckTitle)).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'SAMPLE deck A' }));
      await waitFor(() => expect(mockDeckActions.createCard).toHaveBeenCalledTimes(2));
      expect(mockDeckActions.createCard).toHaveBeenCalledWith(
        'd1',
        expect.objectContaining({ back: { text: 'Please do not', mediaIds: [] } }),
        'n1',
      );
      const saved = mockEditor.setContent.mock.calls.at(-1)?.[0] as DocNode;
      expect(saved.content?.at(-1)?.type).toBe('callout');
      expect(await screen.findByText(s.mnemonic.added)).toBeOnTheScreen();
    });
  });
});
