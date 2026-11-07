import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';

import { LibraryBrowser } from '../components/LibraryBrowser';
import {
  useFolders,
  useLibraryActions,
  useLibraryItems,
  useLibrarySort,
  useTags,
  type LibraryActions,
} from '../hooks';
import type { LibraryItem } from '../logic';
import type { Folder, Tag } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), dismissTo: jest.fn() },
}));
const mockCustomSheets = {
  sheets: [] as { id: string; name: string; boxes: { kind: 'notes'; title: string }[] }[],
  save: jest.fn(),
  remove: jest.fn(async () => {}),
};
jest.mock('@/features/notes/hooks', () => ({ useCustomSheets: () => mockCustomSheets }));
jest.mock('../hooks', () => ({
  useFolders: jest.fn(),
  useTags: jest.fn(),
  useLibraryItems: jest.fn(),
  useLibrarySort: jest.fn(),
  useLibraryActions: jest.fn(),
}));

const s = strings.library;

const folder = (id: string, name: string, parentId: string | null = null): Folder => ({
  id,
  name,
  parentId,
  kind: 'note',
  ownerId: 'o',
  sortOrder: 0,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  deletedAt: null,
  dirty: true,
  syncedAt: null,
});

const tag = (id: string, name: string): Tag => ({
  id,
  name,
  colour: 'teal',
  ownerId: 'o',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  deletedAt: null,
  dirty: true,
  syncedAt: null,
});

const item = (
  id: string,
  name: string,
  tagIds: string[],
  folderId: string | null,
): LibraryItem => ({
  type: 'note',
  id,
  name,
  folderId,
  pinned: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  tagIds,
});

function makeActions() {
  return {
    createFolder: jest.fn(async (_kind, name: string) => folder('new', name)),
    renameFolder: jest.fn(async () => {}),
    moveFolder: jest.fn(async () => {}),
    deleteFolder: jest.fn(async (id: string) => ({ ids: [id, 'child'], deletedAt: 'T' })),
    restoreFolders: jest.fn(async () => {}),
    createTag: jest.fn(),
    updateTag: jest.fn(),
    deleteTag: jest.fn(async () => {}),
    restoreTag: jest.fn(async () => {}),
    setItemTags: jest.fn(),
    createNote: jest.fn(async () => ({ id: 'new-note' })),
    createDeck: jest.fn(async () => ({ id: 'new-deck' })),
    createQuiz: jest.fn(async () => ({ id: 'new-quiz' })),
    moveItem: jest.fn(async () => {}),
    setItemPinned: jest.fn(async () => {}),
    deleteItem: jest.fn(async () => {}),
    restoreItem: jest.fn(async () => {}),
    deleteItems: jest.fn(async () => ({
      notes: { ids: ['n1', 'n2'], deletedAt: 'T2' },
      decks: { ids: [], deletedAt: 'T2' },
      quizzes: { ids: [], deletedAt: 'T2' },
    })),
    restoreItems: jest.fn(async () => {}),
  } as unknown as jest.Mocked<LibraryActions>;
}

function setup({ folders = [] as Folder[], tags = [] as Tag[], items = [] as LibraryItem[] } = {}) {
  const actions = makeActions();
  jest.mocked(useFolders).mockReturnValue(folders);
  jest.mocked(useTags).mockReturnValue(tags);
  jest.mocked(useLibraryItems).mockReturnValue(items);
  jest.mocked(useLibrarySort).mockReturnValue(['name-asc', jest.fn()]);
  jest.mocked(useLibraryActions).mockReturnValue(actions);
  return actions;
}

describe('<LibraryBrowser>', () => {
  it('shows Dozi and a friendly empty state', async () => {
    setup();
    await renderWithProviders(<LibraryBrowser kind="note" folderId={null} />);
    expect(screen.getByText(s.empty.note.title)).toBeOnTheScreen();
    expect(screen.getByLabelText(strings.mascot.label)).toBeOnTheScreen();
  });

  it('lists only the folders at this level, A–Z, with their subfolder count', async () => {
    setup({
      folders: [folder('b', 'Pharm II'), folder('a', 'Pharm I'), folder('c', 'ANS', 'a')],
    });
    await renderWithProviders(<LibraryBrowser kind="note" folderId={null} />);
    const labels = screen
      .getAllByRole('button', { name: /^Folder / })
      .map((el) => el.props.accessibilityLabel);
    expect(labels).toEqual([s.folderLabel('Pharm I'), s.folderLabel('Pharm II')]);
    expect(screen.getByText(s.folderCount(1))).toBeOnTheScreen();
  });

  it('refuses a duplicate folder name, then creates a new one', async () => {
    const actions = setup({ folders: [folder('a', 'Pharm I')] });
    await renderWithProviders(<LibraryBrowser kind="note" folderId={null} />);

    await fireEvent.press(screen.getByRole('button', { name: s.newFolder }));
    await fireEvent.changeText(screen.getByLabelText(s.nameLabel), 'pharm i');
    await fireEvent.press(screen.getByRole('button', { name: s.create }));
    expect(screen.getByText(s.nameProblems.duplicateFolder)).toBeOnTheScreen();
    expect(actions.createFolder).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText(s.nameLabel), 'Pharm III');
    await fireEvent.press(screen.getByRole('button', { name: s.create }));
    expect(actions.createFolder).toHaveBeenCalledWith('note', 'Pharm III', null);
    expect(await screen.findByText(s.created('Pharm III'))).toBeOnTheScreen();
  });

  it('deletes a folder and offers Undo', async () => {
    const actions = setup({ folders: [folder('a', 'Pharm I'), folder('c', 'ANS', 'a')] });
    await renderWithProviders(<LibraryBrowser kind="note" folderId={null} />);

    await fireEvent.press(screen.getByRole('button', { name: s.folderActions('Pharm I') }));
    await fireEvent.press(screen.getByRole('button', { name: s.actions.delete }));
    expect(actions.deleteFolder).toHaveBeenCalledWith('a');
    expect(await screen.findByText(s.deletedWithChildren('Pharm I', 1))).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: s.undo }));
    expect(actions.restoreFolders).toHaveBeenCalledWith({ ids: ['a', 'child'], deletedAt: 'T' });
  });

  describe('long-press multi-select', () => {
    /** Presses the Delete button in the confirm dialog. */
    async function confirmDelete() {
      const call = jest.mocked(Alert.alert).mock.calls.at(-1);
      const buttons = (call?.[2] ?? []) as AlertButton[];
      await act(async () => {
        buttons.find((b) => b.style === 'destructive')?.onPress?.();
      });
    }

    beforeEach(() => {
      jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    it('picks several with a long press then taps, and deletes them together with Undo', async () => {
      const actions = setup({
        folders: [folder('a', 'Pharm I')],
        items: [
          item('n1', 'SAMPLE one', [], null),
          item('n2', 'SAMPLE two', [], null),
          item('n3', 'SAMPLE three', [], null),
        ],
      });
      await renderWithProviders(<LibraryBrowser kind="note" folderId={null} />);

      const one = screen.getByRole('button', { name: s.itemLabel('note', 'SAMPLE one') });
      await fireEvent(one, 'longPress');
      expect(screen.getByText(strings.selection.count(1))).toBeOnTheScreen();
      // While picking, a tap picks instead of opening.
      await fireEvent.press(screen.getByRole('button', { name: s.folderLabel('Pharm I') }));
      await fireEvent.press(
        screen.getByRole('button', { name: s.itemLabel('note', 'SAMPLE two') }),
      );
      expect(router.push).not.toHaveBeenCalled();
      expect(screen.getByText(strings.selection.count(3))).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: strings.selection.delete }));
      expect(Alert.alert).toHaveBeenCalledWith(
        strings.selection.confirmTitle(strings.selection.things(3)),
        strings.selection.confirmFolders,
        expect.any(Array),
      );
      expect(actions.deleteItems).not.toHaveBeenCalled();
      await confirmDelete();

      expect(
        await screen.findByText(strings.selection.deleted(strings.selection.things(3))),
      ).toBeOnTheScreen();
      expect(actions.deleteFolder).toHaveBeenCalledWith('a');
      expect(actions.deleteItems).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'n1' }),
        expect.objectContaining({ id: 'n2' }),
      ]);
      expect(screen.queryByText(strings.selection.count(3))).toBeNull();

      await fireEvent.press(screen.getByRole('button', { name: s.undo }));
      expect(actions.restoreItems).toHaveBeenCalledWith(
        expect.objectContaining({ notes: { ids: ['n1', 'n2'], deletedAt: 'T2' } }),
      );
      expect(actions.restoreFolders).toHaveBeenCalledWith({ ids: ['a', 'child'], deletedAt: 'T' });
    });

    it('deletes nothing when the confirm is cancelled, and ✕ stops selecting', async () => {
      const actions = setup({ items: [item('n1', 'SAMPLE one', [], null)] });
      await renderWithProviders(<LibraryBrowser kind="note" folderId={null} />);

      await fireEvent(
        screen.getByRole('button', { name: s.itemLabel('note', 'SAMPLE one') }),
        'longPress',
      );
      await fireEvent.press(screen.getByRole('button', { name: strings.selection.delete }));
      expect(Alert.alert).toHaveBeenCalledWith(
        strings.selection.confirmTitle(strings.selection.things(1)),
        strings.selection.confirmMessage,
        expect.any(Array),
      );
      expect(actions.deleteItems).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByRole('button', { name: strings.selection.cancel }));
      expect(screen.queryByText(strings.selection.count(1))).toBeNull();
      await fireEvent.press(
        screen.getByRole('button', { name: s.itemLabel('note', 'SAMPLE one') }),
      );
      expect(router.push).toHaveBeenCalledWith({ pathname: '/note/[id]', params: { id: 'n1' } });
    });

    it('selects everything with Select all, and untapping the last one stops selecting', async () => {
      setup({ items: [item('n1', 'SAMPLE one', [], null), item('n2', 'SAMPLE two', [], null)] });
      await renderWithProviders(<LibraryBrowser kind="note" folderId={null} />);

      const one = screen.getByRole('button', { name: s.itemLabel('note', 'SAMPLE one') });
      await fireEvent(one, 'longPress');
      await fireEvent.press(screen.getByRole('button', { name: strings.selection.selectAll }));
      expect(screen.getByText(strings.selection.count(2))).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: strings.selection.selectNone }));
      expect(screen.queryByText(strings.selection.count(2))).toBeNull();

      await fireEvent(one, 'longPress');
      await fireEvent.press(one);
      expect(screen.queryByText(strings.selection.count(1))).toBeNull();
    });
  });

  it('moves a folder, never offering itself as a destination', async () => {
    const actions = setup({
      folders: [folder('a', 'Pharm I'), folder('b', 'Pharm II'), folder('c', 'ANS', 'a')],
    });
    await renderWithProviders(<LibraryBrowser kind="note" folderId={null} />);

    await fireEvent.press(screen.getByRole('button', { name: s.folderActions('Pharm I') }));
    await fireEvent.press(screen.getByRole('button', { name: s.actions.move }));
    expect(screen.queryByRole('button', { name: 'ANS' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Pharm II' }));
    expect(actions.moveFolder).toHaveBeenCalledWith('a', 'b');
  });

  it('filters items by tag across folders', async () => {
    setup({
      folders: [folder('a', 'Pharm I')],
      tags: [tag('t1', 'Exam'), tag('t2', 'ANS')],
      items: [item('n1', 'Beta blockers', ['t1'], 'a'), item('n2', 'Loose note', [], null)],
    });
    await renderWithProviders(<LibraryBrowser kind="note" folderId={null} />);
    expect(screen.getByText('Loose note')).toBeOnTheScreen();
    expect(screen.queryByText('Beta blockers')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Exam' }));
    expect(screen.getByText('Beta blockers')).toBeOnTheScreen();
    expect(screen.queryByText('Loose note')).toBeNull();
    expect(screen.queryByText('Pharm I')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'ANS' }));
    expect(screen.getByText(s.empty.filter.title)).toBeOnTheScreen();
  });

  describe('notes', () => {
    it('opens a note, and makes a new one in this folder (after picking a template)', async () => {
      const actions = setup({ items: [item('n1', 'SAMPLE note', [], 'f1')] });
      await renderWithProviders(<LibraryBrowser kind="note" folderId="f1" />);

      await fireEvent.press(
        screen.getByRole('button', { name: s.itemLabel('note', 'SAMPLE note') }),
      );
      expect(router.push).toHaveBeenCalledWith({ pathname: '/note/[id]', params: { id: 'n1' } });

      await fireEvent.press(screen.getByRole('button', { name: strings.notes.newNote }));
      await fireEvent.press(screen.getByText(strings.notes.templates.names.blank));
      expect(actions.createNote).toHaveBeenCalledWith('f1', null);
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/note/[id]',
        params: { id: 'new-note' },
      });
    });

    it('starts a note from one of my sheets, or builds and saves a new sheet', async () => {
      const mySheet = {
        id: 's1',
        name: 'SAMPLE lab sheet',
        boxes: [{ kind: 'notes' as const, title: 'Notes' }],
      };
      mockCustomSheets.sheets = [mySheet];
      const built = { ...mySheet, id: 's2', name: 'SAMPLE new sheet' };
      mockCustomSheets.save.mockResolvedValue(built);
      const actions = setup({ items: [item('n1', 'SAMPLE note', [], 'f1')] });
      await renderWithProviders(<LibraryBrowser kind="note" folderId="f1" />);

      await fireEvent.press(screen.getByRole('button', { name: strings.notes.newNote }));
      await fireEvent.press(screen.getByText('SAMPLE lab sheet'));
      expect(actions.createNote).toHaveBeenCalledWith('f1', mySheet);

      const c = strings.notes.customSheet;
      await fireEvent.press(screen.getByRole('button', { name: strings.notes.newNote }));
      await fireEvent.press(screen.getByText(c.build));
      expect(screen.getByRole('button', { name: c.save })).toBeDisabled();
      await fireEvent.changeText(screen.getByLabelText(c.nameLabel), 'SAMPLE new sheet');
      await fireEvent.press(screen.getByRole('button', { name: c.boxKinds.mnemonic }));
      await fireEvent.press(screen.getByRole('button', { name: c.moveUp('Mnemonic') }));
      await fireEvent.press(screen.getByRole('button', { name: c.save }));
      expect(mockCustomSheets.save).toHaveBeenCalledWith('SAMPLE new sheet', [
        { kind: 'mnemonic', title: 'Mnemonic' },
        { kind: 'notes', title: 'Notes' },
      ]);
      await waitFor(() => expect(actions.createNote).toHaveBeenLastCalledWith('f1', built));
      mockCustomSheets.sheets = [];
    });

    it('shows each note as a sticky note with its sheet and card count', async () => {
      setup({
        items: [
          { ...item('n1', 'SAMPLE sheet note', [], null), template: 'concept', cardCount: 3 },
          { ...item('n2', 'SAMPLE blank note', [], null), template: null, cardCount: 0 },
        ],
      });
      await renderWithProviders(<LibraryBrowser kind="note" folderId={null} />);
      expect(screen.getByText(strings.notes.templates.names.concept)).toBeTruthy();
      expect(screen.getByText(s.noteCards(3))).toBeTruthy();
      expect(screen.getByText(s.noNoteCards)).toBeTruthy();
      expect(screen.getByRole('button', { name: s.importNotes })).toBeTruthy();
    });

    it('pins, moves and deletes a note from its menu, with Undo', async () => {
      const note = item('n1', 'SAMPLE note', [], null);
      const actions = setup({ folders: [folder('a', 'Pharm I')], items: [note] });
      await renderWithProviders(<LibraryBrowser kind="note" folderId={null} />);
      const openMenu = () =>
        fireEvent.press(screen.getByRole('button', { name: s.folderActions('SAMPLE note') }));

      await openMenu();
      await fireEvent.press(screen.getByRole('button', { name: s.actions.pin }));
      expect(actions.setItemPinned).toHaveBeenCalledWith(note, true);

      await openMenu();
      await fireEvent.press(screen.getByRole('button', { name: s.actions.move }));
      // The folder row behind the sheet has the same name; the picker's row is the last one.
      const targets = screen.getAllByText('Pharm I');
      await fireEvent.press(targets[targets.length - 1]);
      expect(actions.moveItem).toHaveBeenCalledWith(note, 'a');

      await openMenu();
      await fireEvent.press(screen.getByRole('button', { name: s.actions.delete }));
      expect(actions.deleteItem).toHaveBeenCalledWith(note);
      await fireEvent.press(await screen.findByText(s.undo));
      expect(actions.restoreItem).toHaveBeenCalledWith(note);
    });
  });

  describe('decks', () => {
    it('opens a deck, and makes a new one in this folder', async () => {
      const deck: LibraryItem = { ...item('d1', 'SAMPLE deck', [], 'f1'), type: 'deck' };
      const actions = setup({ items: [deck] });
      await renderWithProviders(<LibraryBrowser kind="deck" folderId="f1" />);

      await fireEvent.press(
        screen.getByRole('button', { name: s.itemLabel('deck', 'SAMPLE deck') }),
      );
      expect(router.push).toHaveBeenCalledWith({ pathname: '/deck/[id]', params: { id: 'd1' } });

      await fireEvent.press(screen.getByRole('button', { name: strings.decks.newDeck }));
      await fireEvent.press(screen.getByRole('button', { name: s.create }));
      expect(screen.getByText(strings.decks.titleProblems.empty)).toBeOnTheScreen();
      await fireEvent.changeText(screen.getByLabelText(s.nameLabel), 'Second deck');
      await fireEvent.press(screen.getByRole('button', { name: s.create }));
      expect(actions.createDeck).toHaveBeenCalledWith('f1', 'Second deck');
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/deck/[id]',
        params: { id: 'new-deck' },
      });
    });

    it('offers "New deck" in an empty Decks segment', async () => {
      setup();
      await renderWithProviders(<LibraryBrowser kind="deck" folderId={null} />);
      expect(screen.getByText(s.empty.deck.title)).toBeOnTheScreen();
      expect(screen.getAllByRole('button', { name: strings.decks.newDeck }).length).toBe(2);
    });
  });

  describe('quizzes', () => {
    it('opens a quiz in the builder, and makes a new one in this folder', async () => {
      const quiz: LibraryItem = { ...item('q1', 'SAMPLE quiz', [], 'f1'), type: 'quiz' };
      const actions = setup({ items: [quiz] });
      await renderWithProviders(<LibraryBrowser kind="quiz" folderId="f1" />);

      await fireEvent.press(
        screen.getByRole('button', { name: s.itemLabel('quiz', 'SAMPLE quiz') }),
      );
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/quiz/[id]/edit',
        params: { id: 'q1' },
      });

      await fireEvent.press(screen.getByRole('button', { name: strings.quizzes.newQuiz }));
      await fireEvent.press(screen.getByRole('button', { name: s.create }));
      expect(screen.getByText(strings.quizzes.titleProblems.empty)).toBeOnTheScreen();
      await fireEvent.changeText(screen.getByLabelText(s.nameLabel), 'Second quiz');
      await fireEvent.press(screen.getByRole('button', { name: s.create }));
      expect(actions.createQuiz).toHaveBeenCalledWith('f1', 'Second quiz');
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/quiz/[id]/edit',
        params: { id: 'new-quiz' },
      });
    });

    it('offers "New quiz" and the question bank in an empty Quizzes segment', async () => {
      setup();
      await renderWithProviders(<LibraryBrowser kind="quiz" folderId={null} />);
      expect(screen.getByText(s.empty.quiz.title)).toBeOnTheScreen();
      expect(screen.getAllByRole('button', { name: strings.quizzes.newQuiz }).length).toBe(2);
      await fireEvent.press(screen.getByRole('button', { name: strings.questions.bankTitle }));
      expect(router.push).toHaveBeenCalledWith('/questions');
    });
  });
});
