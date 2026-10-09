import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

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
    moveItem: jest.fn(async () => {}),
    setItemPinned: jest.fn(async () => {}),
    deleteItem: jest.fn(async () => {}),
    restoreItem: jest.fn(async () => {}),
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
    it('opens a note, and makes a new one in this folder', async () => {
      const actions = setup({ items: [item('n1', 'SAMPLE note', [], 'f1')] });
      await renderWithProviders(<LibraryBrowser kind="note" folderId="f1" />);

      await fireEvent.press(
        screen.getByRole('button', { name: s.itemLabel('note', 'SAMPLE note') }),
      );
      expect(router.push).toHaveBeenCalledWith({ pathname: '/note/[id]', params: { id: 'n1' } });

      await fireEvent.press(screen.getByRole('button', { name: strings.notes.newNote }));
      expect(actions.createNote).toHaveBeenCalledWith('f1');
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/note/[id]',
        params: { id: 'new-note' },
      });
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
});
