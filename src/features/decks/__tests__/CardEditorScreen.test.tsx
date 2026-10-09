import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import type { Card, Deck } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

import { CardEditorScreen } from '../components/CardEditorScreen';
import { useCard, useDeck } from '../hooks';
import { summariseDraft, type CardDraft } from '../logic';

// SAMPLE content for tests only — made-up words, no drug facts.
const s = strings.cards;

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
}));

const mockActions = {
  createCard: jest.fn(async () => ({ id: 'new-card' })),
  updateCard: jest.fn(async () => {}),
  deleteCard: jest.fn(async () => 'deleted-at'),
  restoreCard: jest.fn(async () => {}),
};
jest.mock('../hooks', () => ({
  useDeck: jest.fn(),
  useCard: jest.fn(),
  useDeckActions: () => mockActions,
}));

const mockAddImage = jest.fn();
const mockDeleteMedia = jest.fn(async () => {});
jest.mock('@/features/media/hooks', () => ({
  useAddImage: () => mockAddImage,
  useDeleteMedia: () => mockDeleteMedia,
  useMediaUri: () => ({ uri: null, loading: false }),
}));

const deck = { id: 'd1', title: 'SAMPLE deck', deletedAt: null } as Deck;

function savedCard(draft: CardDraft): Card {
  return {
    id: 'c1',
    deckId: 'd1',
    type: draft.type,
    deletedAt: null,
    ...summariseDraft(draft),
  } as Card;
}

const empty = { text: '', mediaIds: [] };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useDeck).mockReturnValue({ deck, loading: false });
  jest.mocked(useCard).mockReturnValue({ card: undefined, loading: false });
});

const frontField = () => screen.getByLabelText(s.fields.front);

describe('card editor', () => {
  it('saves a basic card and goes back to the deck', async () => {
    await renderWithProviders(<CardEditorScreen deckId="d1" cardId="new" />);
    expect(screen.getByText(s.newTitle)).toBeOnTheScreen();
    await fireEvent.changeText(frontField(), 'Front words');
    await fireEvent.changeText(screen.getByLabelText(s.fields.back), 'Back words');
    await fireEvent.press(screen.getByRole('button', { name: s.save }));
    expect(mockActions.createCard).toHaveBeenCalledWith('d1', {
      type: 'basic',
      front: { text: 'Front words', mediaIds: [] },
      back: { text: 'Back words', mediaIds: [] },
      extra: empty,
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('explains what is missing instead of saving', async () => {
    await renderWithProviders(<CardEditorScreen deckId="d1" cardId="new" />);
    await fireEvent.changeText(frontField(), 'Only a front');
    await fireEvent.press(screen.getByRole('button', { name: s.save }));
    expect(screen.getByText(s.problems.backEmpty)).toBeOnTheScreen();
    expect(mockActions.createCard).not.toHaveBeenCalled();
  });

  it('wraps selected words with the cloze button and previews one card per number', async () => {
    await renderWithProviders(<CardEditorScreen deckId="d1" cardId="new" />);
    await fireEvent.press(screen.getByRole('radio', { name: s.types.cloze }));
    const text = screen.getByLabelText(s.fields.clozeText);
    await fireEvent.changeText(text, 'The first and second word');
    await fireEvent(text, 'selectionChange', { nativeEvent: { selection: { start: 4, end: 9 } } });
    await fireEvent.press(screen.getByRole('button', { name: s.clozeButton(1) }));
    expect(screen.getByLabelText(s.fields.clozeText).props.value).toBe(
      'The {{c1::first}} and second word',
    );

    const current = 'The {{c1::first}} and second word';
    const start = current.indexOf('second');
    await fireEvent(screen.getByLabelText(s.fields.clozeText), 'selectionChange', {
      nativeEvent: { selection: { start, end: start + 'second'.length } },
    });
    await fireEvent.press(screen.getByRole('button', { name: s.clozeButton(2) }));
    expect(screen.getByLabelText(s.fields.clozeText).props.value).toBe(
      'The {{c1::first}} and {{c2::second}} word',
    );
    expect(screen.getByText(s.clozeCount(2))).toBeOnTheScreen();

    await fireEvent.press(screen.getAllByRole('button', { name: s.preview })[0]);
    expect(screen.getByText(`${s.previewCard(1, 2)} · c1`)).toBeOnTheScreen();
    expect(screen.getByText(`${s.previewCard(2, 2)} · c2`)).toBeOnTheScreen();
  });

  it('keeps the editor open with a fresh card in bulk-add mode', async () => {
    await renderWithProviders(<CardEditorScreen deckId="d1" cardId="new" />);
    await fireEvent(screen.getByLabelText(s.keepAdding), 'valueChange', true);
    await fireEvent.changeText(frontField(), 'One');
    await fireEvent.changeText(screen.getByLabelText(s.fields.back), 'Two');
    await fireEvent.press(screen.getByRole('button', { name: s.save }));
    expect(mockActions.createCard).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
    expect(await screen.findByText(s.addedNext)).toBeOnTheScreen();
    expect(frontField().props.value).toBe('');
  });

  it('adds an image to a field and drops it if the card is left unsaved', async () => {
    mockAddImage.mockResolvedValue({ status: 'saved', media: { id: 'm9' } });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderWithProviders(<CardEditorScreen deckId="d1" cardId="new" />);
    await fireEvent.press(screen.getAllByRole('button', { name: s.addImage })[0]);
    await fireEvent.press(screen.getByText(s.fromGallery));
    expect(mockAddImage).toHaveBeenCalledWith('library');
    expect(await screen.findByLabelText(s.removeImage)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: s.back }));
    expect(alert).toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] ?? [];
    buttons.find((b) => b.text === s.discard)?.onPress?.();
    expect(mockDeleteMedia).toHaveBeenCalledWith('m9');
    expect(router.back).toHaveBeenCalled();
    alert.mockRestore();
  });

  it('edits an existing card and can delete it with undo', async () => {
    jest.mocked(useCard).mockReturnValue({
      card: savedCard({
        type: 'type_in',
        front: { text: 'Question', mediaIds: [] },
        back: { text: 'answer', mediaIds: [] },
        extra: empty,
      }),
      loading: false,
    });
    await renderWithProviders(<CardEditorScreen deckId="d1" cardId="c1" />);
    expect(screen.getByText(s.editTitle)).toBeOnTheScreen();
    expect(screen.getByLabelText(s.fields.answer).props.value).toBe('answer');
    await fireEvent.changeText(screen.getByLabelText(s.fields.answer), 'better answer');
    await fireEvent.press(screen.getByRole('button', { name: s.save }));
    expect(mockActions.updateCard).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ type: 'type_in', back: { text: 'better answer', mediaIds: [] } }),
    );

    await fireEvent.press(screen.getByRole('button', { name: s.deleteCard }));
    expect(mockActions.deleteCard).toHaveBeenCalledWith('c1');
    await fireEvent.press(await screen.findByText(strings.library.undo));
    expect(mockActions.restoreCard).toHaveBeenCalledWith('c1', 'deleted-at');
  });

  it('says so when the card or deck is gone', async () => {
    jest.mocked(useCard).mockReturnValue({ card: undefined, loading: false });
    await renderWithProviders(<CardEditorScreen deckId="d1" cardId="gone" />);
    expect(screen.getByText(s.missingTitle)).toBeOnTheScreen();
  });
});
