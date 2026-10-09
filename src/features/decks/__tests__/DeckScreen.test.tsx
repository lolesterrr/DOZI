import { fireEvent, screen } from '@testing-library/react-native';
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
};
jest.mock('../hooks', () => ({
  useDeck: jest.fn(),
  useDeckCards: jest.fn(),
  useDeckActions: () => mockActions,
}));
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

  it('says so when the deck is gone', async () => {
    jest.mocked(useDeck).mockReturnValue({ deck: undefined, loading: false });
    await renderWithProviders(<DeckScreen id="gone" />);
    expect(screen.getByText(s.missingTitle)).toBeOnTheScreen();
  });
});
