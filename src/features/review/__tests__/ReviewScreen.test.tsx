import { fireEvent, screen } from '@testing-library/react-native';
import { count, eq } from 'drizzle-orm';
import { router } from 'expo-router';

import { cards, reviewLogs } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { CardDraft } from '@/features/decks/logic';
import { createCard, createDeck, listCardInstances } from '@/features/decks/repo';
import { getCardState } from '@/features/srs/repo';
import { strings } from '@/i18n/strings';
import { createTestDatabase } from '@/test-utils/db';
import { renderWithProviders } from '@/test-utils/render';

import { ReviewScreen } from '../components/ReviewScreen';
import type { ReviewMode } from '../logic';

// The whole review screen against a real (in-memory) database: answers are saved through FSRS,
// undo puts the card back, suspend and cram mode work.
// SAMPLE content for tests only — made-up words, no drug facts.
const s = strings.review;
const owner = 'owner-1';

let mockDb: AppDatabase;
jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: () => mockDb }));
jest.mock('@/features/profile/hooks', () => ({
  useProfile: () => ({ profile: { id: 'owner-1', timezone: 'Africa/Kampala' } }),
}));
// Images aren't on disk in tests: the diagram shows as "not on this phone".
jest.mock('@/features/media/hooks', () => ({
  ...jest.requireActual('@/features/media/hooks'),
  useMediaUri: () => ({ uri: null, loading: false }),
}));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    ...jest.requireActual('expo-router'),
    router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
    // No navigator in this test: "focus" is simply mounting.
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});

const field = (text: string) => ({ text, mediaIds: [] });
const basic: CardDraft = {
  type: 'basic',
  front: field('SAMPLE question one'),
  back: field('SAMPLE answer one'),
  extra: field('SAMPLE extra'),
};
const typeIn: CardDraft = {
  type: 'type_in',
  front: field('SAMPLE question two'),
  back: field('samplerix'),
  extra: field(''),
};

let deckId: string;
let instances: string[];
let cardIds: string[];

beforeEach(async () => {
  jest.clearAllMocks();
  mockDb = createTestDatabase();
  const deck = await createDeck(mockDb, { ownerId: owner, title: 'SAMPLE deck' });
  deckId = deck.id;
  const earlier = new Date(Date.now() - 60_000).toISOString();
  const first = await createCard(
    mockDb,
    { ownerId: owner, deckId, draft: basic },
    { now: () => earlier },
  );
  const second = await createCard(mockDb, { ownerId: owner, deckId, draft: typeIn });
  cardIds = [first.id, second.id];
  instances = [
    (await listCardInstances(mockDb, first.id))[0].id,
    (await listCardInstances(mockDb, second.id))[0].id,
  ];
});

const renderReview = (mode: ReviewMode = 'review') =>
  renderWithProviders(<ReviewScreen scope={{ deckId }} mode={mode} />);

const ratingButton = (name: 'Again' | 'Hard' | 'Good' | 'Easy') =>
  screen.getByRole('button', { name: new RegExp(`^${name}, next review in \\d+(m|h|d|mo)$`) });

async function logCount() {
  const [row] = await mockDb.select({ n: count() }).from(reviewLogs);
  return row.n;
}

describe('review screen', () => {
  it('reviews a deck: flip, rate with intervals, type-in diff, summary, undo', async () => {
    await renderReview();
    expect(await screen.findByText('SAMPLE question one')).toBeOnTheScreen();
    expect(screen.getByText(s.counts(2, 0, 0))).toBeOnTheScreen();
    expect(screen.queryByText('SAMPLE answer one')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: s.showAnswer }));
    expect(screen.getByText('SAMPLE answer one')).toBeOnTheScreen();
    expect(screen.getByText('SAMPLE extra')).toBeOnTheScreen();
    for (const name of ['Again', 'Hard', 'Good', 'Easy'] as const)
      expect(ratingButton(name)).toBeOnTheScreen();

    await fireEvent.press(ratingButton('Easy'));
    expect(await screen.findByText('SAMPLE question two')).toBeOnTheScreen();
    // Due date moved on: an Easy new card goes straight to review, days away.
    const state = await getCardState(mockDb, instances[0]);
    expect(state).toMatchObject({ state: 'review', reps: 1 });
    expect(Date.parse(state!.due)).toBeGreaterThan(Date.now() + 24 * 60 * 60_000);

    // Type-in: a small slip is "close", and the diff shows both texts.
    await fireEvent.changeText(screen.getByLabelText(s.typeLabel), 'samplrix');
    await fireEvent.press(screen.getByRole('button', { name: s.check }));
    expect(screen.getByText(s.verdicts.close)).toBeOnTheScreen();
    expect(screen.getByText(s.youTyped)).toBeOnTheScreen();
    expect(screen.getByText(s.diffHelp)).toBeOnTheScreen();

    await fireEvent.press(ratingButton('Easy'));
    expect(await screen.findByText(s.summary.title)).toBeOnTheScreen();
    expect(screen.getByLabelText(`${s.summary.cards}: 2`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`${s.summary.remembered}: 100%`)).toBeOnTheScreen();
    expect(screen.getByTestId('dozi-celebrating')).toBeOnTheScreen();
    expect(await logCount()).toBe(2);

    // Undo: the last card comes back, new again, and its log is gone.
    await fireEvent.press(screen.getByRole('button', { name: s.undo }));
    expect(await screen.findByText('SAMPLE question two')).toBeOnTheScreen();
    expect(await getCardState(mockDb, instances[1])).toBeNull();
    const [live] = await mockDb
      .select({ n: count() })
      .from(reviewLogs)
      .where(eq(reviewLogs.cardInstanceId, instances[1]));
    expect(live.n).toBe(1); // soft-deleted, still stored for sync
    expect(await getCardState(mockDb, instances[0])).toMatchObject({ state: 'review' });

    await fireEvent.press(screen.getByRole('button', { name: s.close }));
    expect(router.back).toHaveBeenCalled();
  });

  it('suspends the card on screen, with undo', async () => {
    await renderReview();
    expect(await screen.findByText('SAMPLE question one')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: s.moreOptions }));
    await fireEvent.press(screen.getByText(s.actions.suspend));
    expect(await screen.findByText('SAMPLE question two')).toBeOnTheScreen();
    const [card] = await mockDb.select().from(cards).where(eq(cards.id, cardIds[0]));
    expect(card.suspended).toBe(true);

    await fireEvent.press(await screen.findByText(s.undoAction));
    expect(await screen.findByText('SAMPLE question one')).toBeOnTheScreen();
    const [back] = await mockDb.select().from(cards).where(eq(cards.id, cardIds[0]));
    expect(back.suspended).toBe(false);
  });

  it('buries the card on screen until tomorrow', async () => {
    await renderReview();
    expect(await screen.findByText('SAMPLE question one')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: s.moreOptions }));
    await fireEvent.press(screen.getByText(s.actions.bury));
    expect(await screen.findByText('SAMPLE question two')).toBeOnTheScreen();
    expect(await screen.findByText(s.buried)).toBeOnTheScreen();
  });

  it('cram mode changes nothing in the schedule', async () => {
    await renderReview('cram');
    // The order is shuffled: the first card may be the basic one or the type-in one.
    const reveal = () => screen.findByRole('button', { name: /^(Show answer|Check)$/ });
    await fireEvent.press(await reveal());
    expect(screen.getByText(s.cramLeft(2))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: s.ratings.again }));
    // "Again" keeps the card in the session.
    expect(await screen.findByText(s.cramLeft(2))).toBeOnTheScreen();
    for (let k = 0; k < 2; k++) {
      await fireEvent.press(await reveal());
      await fireEvent.press(screen.getByRole('button', { name: s.cramGotIt }));
    }
    expect(await screen.findByText(s.summary.cramTitle)).toBeOnTheScreen();
    expect(screen.getByText(s.summary.cramNote)).toBeOnTheScreen();
    expect(await logCount()).toBe(0);
    expect(await getCardState(mockDb, instances[0])).toBeNull();
  });

  it('says so when nothing is due, and offers cram mode', async () => {
    await mockDb.update(cards).set({ suspended: true });
    await renderReview();
    expect(await screen.findByText(s.empty.title)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: s.empty.cram }));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/review/[scope]',
      params: { scope: deckId, mode: 'cram' },
    });
  });

  it('reviews an image occlusion card: a covered box, then uncovered with its label', async () => {
    const o = strings.occlusion;
    const deck = await createDeck(mockDb, { ownerId: owner, title: 'SAMPLE diagrams' });
    const box = (n: number, label: string) => ({
      id: `m00${n}`,
      x: 0.2 * n,
      y: 0.2,
      w: 0.15,
      h: 0.1,
      label,
    });
    await createCard(mockDb, {
      ownerId: owner,
      deckId: deck.id,
      draft: {
        type: 'image_occlusion',
        front: field('SAMPLE prompt'),
        back: field(''),
        extra: field(''),
        occlusion: {
          mediaId: 'diagram',
          width: 800,
          height: 600,
          mode: 'hide_all',
          masks: [box(1, 'SAMPLE first'), box(2, 'SAMPLE second')],
          nextMask: 3,
        },
      },
    });
    await renderWithProviders(<ReviewScreen scope={{ deckId: deck.id }} mode="review" />);
    expect(await screen.findByText('SAMPLE prompt')).toBeOnTheScreen();
    expect(screen.getByText(s.counts(2, 0, 0))).toBeOnTheScreen();
    expect(screen.getByLabelText(o.pictureAsked(1, 2))).toBeOnTheScreen();
    expect(screen.getByTestId('occlusion-box-asked')).toBeOnTheScreen();
    expect(screen.getAllByTestId('occlusion-box-covered')).toHaveLength(1);
    expect(screen.queryByText('SAMPLE first')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: s.showAnswer }));
    expect(screen.getByLabelText(o.pictureRevealed(1, 2))).toBeOnTheScreen();
    expect(screen.getByTestId('occlusion-box-revealed')).toBeOnTheScreen();
    expect(screen.getByText('SAMPLE first')).toBeOnTheScreen();
    // The prompt and diagram show once on the answer side, not twice.
    expect(screen.getAllByText('SAMPLE prompt')).toHaveLength(1);

    await fireEvent.press(ratingButton('Good'));
    expect(await screen.findByLabelText(o.pictureAsked(2, 2))).toBeOnTheScreen();
  });
});
