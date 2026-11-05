import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { router } from 'expo-router';

import type { Card, Deck } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

import { DeckScreen } from '../components/DeckScreen';
import { useDeck, useDeckCards } from '../hooks';
import { summariseDraft } from '../logic';

// SAMPLE content for tests only — made-up words, no drug facts.
const s = strings.decks;

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
}));

const mockActions = {
  updateSettings: jest.fn(async () => {}),
  deleteDeck: jest.fn(async () => 'deleted-at'),
  restoreDeck: jest.fn(async () => {}),
  renameDeck: jest.fn(async () => {}),
  setPinned: jest.fn(async () => {}),
  moveDeck: jest.fn(async () => {}),
  deleteCards: jest.fn(async () => 'cards-deleted-at'),
  restoreCards: jest.fn(async () => {}),
  changeCardsTag: jest.fn(async () => [{ cardId: 'c2', tagsJson: '[]' }]),
  restoreCardTags: jest.fn(async () => {}),
};
jest.mock('../hooks', () => ({
  useDeck: jest.fn(),
  useDeckCards: jest.fn(),
  useDeckActions: () => mockActions,
}));
const mockTransfer = {
  pickCsv: jest.fn(),
  importCsv: jest.fn(async () => ({
    cardIds: ['n1', 'n2'],
    retagged: [{ cardId: 'old', tagsJson: '[]' }],
    importedAt: 'now',
  })),
  undoImport: jest.fn(async () => {}),
  exportDeckCsv: jest.fn(async () => ({ status: 'shared', notes: [] as string[] })),
};
jest.mock('@/features/export/hooks', () => ({ useTransferActions: () => mockTransfer }));
jest.mock('@/features/review/hooks', () => ({ useDueCount: () => 2 }));
jest.mock('@/features/library/hooks', () => ({
  useFolders: () => [],
  useTags: () => [],
  useItemTagMap: () => new Map(),
  useLibraryActions: () => ({ setItemTags: jest.fn(), createTag: jest.fn() }),
}));

const deck = {
  id: 'd1',
  title: 'SAMPLE deck',
  description: '',
  deletedAt: null,
  pinned: false,
  folderId: null,
  newPerDay: 15,
  maxReviewsPerDay: 200,
  desiredRetention: 0.9,
} as Deck;

const card = {
  id: 'c1',
  deckId: 'd1',
  type: 'cloze',
  ...summariseDraft({
    type: 'cloze',
    front: { text: 'A {{c1::b}} {{c2::c}}', mediaIds: [] },
    back: { text: '', mediaIds: [] },
    extra: { text: '', mediaIds: [] },
  }),
} as Card;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useDeck).mockReturnValue({ deck, loading: false });
  jest.mocked(useDeckCards).mockReturnValue([card]);
});

describe('deck screen', () => {
  it('lists the cards with a summary and opens the editor', async () => {
    await renderWithProviders(<DeckScreen id="d1" />);
    expect(screen.getByText('SAMPLE deck')).toBeOnTheScreen();
    expect(screen.getByText(s.summary(1, 2))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: s.cardActions('A b c') }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/deck/[id]/card/[cardId]',
      params: { id: 'd1', cardId: 'c1' },
    });
    await fireEvent.press(screen.getByRole('button', { name: s.addCards }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/deck/[id]/card/[cardId]',
      params: { id: 'd1', cardId: 'new' },
    });
  });

  it('starts a review of the due cards, or cram mode from the menu', async () => {
    await renderWithProviders(<DeckScreen id="d1" />);
    await fireEvent.press(screen.getByRole('button', { name: s.studyCount(2) }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/review/[scope]',
      params: { scope: 'd1' },
    });
    await fireEvent.press(screen.getByRole('button', { name: s.moreOptions }));
    await fireEvent.press(screen.getByText(s.cram));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/review/[scope]',
      params: { scope: 'd1', mode: 'cram' },
    });
  });

  it('checks and saves the deck settings', async () => {
    await renderWithProviders(<DeckScreen id="d1" />);
    await fireEvent.press(screen.getByRole('button', { name: s.actions.settings }));
    const retention = screen.getByLabelText(s.settings.retention);
    expect(retention.props.value).toBe('90');
    await fireEvent.changeText(retention, '50');
    await fireEvent.press(screen.getByRole('button', { name: s.settings.save }));
    expect(screen.getByText(s.settings.outOfRange(70, 99))).toBeOnTheScreen();
    expect(mockActions.updateSettings).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText(s.settings.retention), '85');
    await fireEvent.changeText(screen.getByLabelText(s.settings.newPerDay), '20');
    await fireEvent.press(screen.getByRole('button', { name: s.settings.save }));
    expect(mockActions.updateSettings).toHaveBeenCalledWith('d1', {
      newPerDay: 20,
      maxReviewsPerDay: 200,
      desiredRetention: 0.85,
    });
  });

  it('deletes the deck with undo', async () => {
    await renderWithProviders(<DeckScreen id="d1" />);
    await fireEvent.press(screen.getByRole('button', { name: s.moreOptions }));
    await fireEvent.press(screen.getByText(s.actions.delete));
    expect(mockActions.deleteDeck).toHaveBeenCalledWith('d1');
    expect(router.back).toHaveBeenCalled();
    await fireEvent.press(await screen.findByText(strings.library.undo));
    expect(mockActions.restoreDeck).toHaveBeenCalledWith('d1', 'deleted-at');
  });

  it('imports cards from a CSV after showing what it found, with undo', async () => {
    const t = strings.transfer;
    const plan = {
      drafts: [
        { type: 'basic', front: { text: 'a', mediaIds: [] }, back: { text: 'b', mediaIds: [] } },
        { type: 'basic', front: { text: 'c', mediaIds: [] }, back: { text: 'd', mediaIds: [] } },
      ],
      draftTags: [['Sample'], []],
      tags: ['Sample'],
      skipped: [{ row: 4, reason: 'backEmpty' }],
      truncated: false,
    };
    const effect = { added: 2, existing: 1, repeated: 0 };
    mockTransfer.pickCsv
      .mockResolvedValueOnce({ status: 'error', message: t.errors.empty })
      .mockResolvedValueOnce({ status: 'ok', fileName: 'sample.csv', plan, effect });
    await renderWithProviders(<DeckScreen id="d1" />);
    await fireEvent.press(screen.getByRole('button', { name: s.moreOptions }));
    await fireEvent.press(screen.getByText(t.importCsv));
    await fireEvent.press(screen.getByRole('button', { name: t.pickFile }));
    expect(await screen.findByText(t.errors.empty)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: t.pickFile }));
    expect(await screen.findByText(t.found(2))).toBeOnTheScreen();
    expect(screen.getByText(t.skippedRow(4, t.skipReasons.backEmpty))).toBeOnTheScreen();
    expect(screen.getByText(t.tagsFound('Sample'))).toBeOnTheScreen();
    expect(screen.getByText(t.alreadyInDeck(1))).toBeOnTheScreen();
    expect(mockTransfer.pickCsv).toHaveBeenLastCalledWith('d1');
    expect(mockTransfer.importCsv).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: t.addCards(2) }));
    expect(mockTransfer.importCsv).toHaveBeenCalledWith('d1', plan);
    expect(await screen.findByText(t.importedAndRetagged(2, 1))).toBeOnTheScreen();
    await fireEvent.press(screen.getByText(t.undo));
    expect(mockTransfer.undoImport).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ cardIds: ['n1', 'n2'] }),
    );
  });

  it('exports the deck as CSV from the menu', async () => {
    mockTransfer.exportDeckCsv.mockResolvedValueOnce({
      status: 'shared',
      notes: [strings.transfer.csvNoImages],
    });
    await renderWithProviders(<DeckScreen id="d1" />);
    await fireEvent.press(screen.getByRole('button', { name: s.moreOptions }));
    await fireEvent.press(screen.getByText(strings.transfer.exportCsv));
    // iOS: the export waits for the menu to finish closing first.
    await waitFor(() =>
      expect(mockTransfer.exportDeckCsv).toHaveBeenCalledWith('d1', 'SAMPLE deck'),
    );
    expect(await screen.findByText(strings.transfer.csvNoImages)).toBeOnTheScreen();
  });

  it('says so when the deck is gone', async () => {
    jest.mocked(useDeck).mockReturnValue({ deck: undefined, loading: false });
    await renderWithProviders(<DeckScreen id="gone" />);
    expect(screen.getByText(s.missingTitle)).toBeOnTheScreen();
  });

  it('long press picks several cards, and deletes them together after asking, with Undo', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const second = { ...card, id: 'c2', frontText: 'SAMPLE second', frontJson: '' } as Card;
    jest.mocked(useDeckCards).mockReturnValue([card, second]);
    await renderWithProviders(<DeckScreen id="d1" />);

    await fireEvent(
      screen.getByRole('button', { name: s.cardActions('SAMPLE second') }),
      'longPress',
    );
    expect(screen.getByText(strings.selection.count(1))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: strings.selection.selectAll }));
    expect(screen.getByText(strings.selection.count(2))).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: strings.selection.delete }));
    const buttons = jest.mocked(Alert.alert).mock.calls[0]?.[2] as AlertButton[];
    expect(mockActions.deleteCards).not.toHaveBeenCalled();
    await act(async () => {
      buttons.find((b) => b.style === 'destructive')?.onPress?.();
    });
    expect(mockActions.deleteCards).toHaveBeenCalledWith(['c1', 'c2']);
    await fireEvent.press(await screen.findByRole('button', { name: strings.library.undo }));
    expect(mockActions.restoreCards).toHaveBeenCalledWith(['c1', 'c2'], 'cards-deleted-at');
  });

  it('filters the cards by a card tag, crams that tag and adds cards with it', async () => {
    const tagged = {
      ...card,
      id: 'c2',
      frontText: 'SAMPLE tagged',
      frontJson: '',
      tagsJson: '["Year 2"]',
    } as Card;
    jest.mocked(useDeckCards).mockReturnValue([card, tagged]);
    await renderWithProviders(<DeckScreen id="d1" />);
    expect(screen.getByRole('button', { name: s.cardActions('A b c') })).toBeOnTheScreen();
    expect(screen.getByText(s.cardTags.list('Year 2'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: s.cardTags.tag('Year 2', 1) }));
    expect(screen.queryByRole('button', { name: s.cardActions('A b c') })).toBeNull();
    expect(screen.getByRole('button', { name: s.cardActions('SAMPLE tagged') })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: s.cramTag('Year 2') }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/review/[scope]',
      params: { scope: 'd1', mode: 'cram', tag: 'Year 2' },
    });
    await fireEvent.press(screen.getByRole('button', { name: s.addCards }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/deck/[id]/card/[cardId]',
      params: { id: 'd1', cardId: 'new', tag: 'Year 2' },
    });

    await fireEvent.press(screen.getByRole('radio', { name: s.cardTags.all(2) }));
    expect(screen.getByRole('button', { name: s.cardActions('A b c') })).toBeOnTheScreen();
  });

  it('tags several selected cards at once, with Undo', async () => {
    const second = {
      ...card,
      id: 'c2',
      frontText: 'SAMPLE second',
      frontJson: '',
      tagsJson: '["Sample"]',
    } as Card;
    jest.mocked(useDeckCards).mockReturnValue([card, second]);
    await renderWithProviders(<DeckScreen id="d1" />);
    await fireEvent(
      screen.getByRole('button', { name: s.cardActions('SAMPLE second') }),
      'longPress',
    );
    await fireEvent.press(screen.getByRole('button', { name: strings.selection.selectAll }));
    await fireEvent.press(screen.getByRole('button', { name: strings.selection.tag }));
    expect(screen.getByText(s.cardTags.sheetTitle(2))).toBeOnTheScreen();
    // "Sample" is on one of the two cards: tapping it puts it on both.
    await fireEvent.press(
      screen.getByRole('button', { name: strings.cards.tags.onSomeLabel('Sample') }),
    );
    expect(mockActions.changeCardsTag).toHaveBeenLastCalledWith(['c1', 'c2'], 'Sample', 'add');

    await fireEvent.changeText(screen.getByLabelText(strings.cards.tags.inputLabel), 'New one');
    await fireEvent.press(screen.getByRole('button', { name: strings.cards.tags.add('New one') }));
    expect(mockActions.changeCardsTag).toHaveBeenLastCalledWith(['c1', 'c2'], 'New one', 'add');
    expect(await screen.findByText(s.cardTags.added('New one', 1))).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('button', { name: strings.library.undo })[0]);
    expect(mockActions.restoreCardTags).toHaveBeenCalledWith([{ cardId: 'c2', tagsJson: '[]' }]);
  });
});
