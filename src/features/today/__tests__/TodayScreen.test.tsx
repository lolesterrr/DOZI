import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { AppDatabase } from '@/db/types';
import { createDeck, createCard, listCardInstances } from '@/features/decks/repo';
import { awardXp } from '@/features/gamification/repo';
import { createNote } from '@/features/notes/repo';
import { answerCard } from '@/features/srs/repo';
import { strings } from '@/i18n/strings';
import { createLiveTestDatabase } from '@/test-utils/liveQueries';
import { renderWithProviders } from '@/test-utils/render';

import { TodayScreen } from '../components/TodayScreen';

// The whole Today screen against a real (in-memory) database with live queries.
// SAMPLE content for tests only — made-up words, no drug facts.
const s = strings.today;
const owner = 'owner-1';

let mockDb: AppDatabase;
jest.mock('expo-sqlite', () => jest.requireActual('@/test-utils/liveQueries').expoSqliteMock);
jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: () => mockDb }));
jest.mock('@/features/profile/hooks', () => ({
  useProfile: () => ({
    profile: { id: 'owner-1', timezone: 'Africa/Kampala', dailyGoalXp: 50 },
  }),
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
const basic = (n: number) => ({
  type: 'basic' as const,
  front: field(`SAMPLE question ${n}`),
  back: field(`SAMPLE answer ${n}`),
  extra: field(''),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDb = createLiveTestDatabase();
});

describe('Today screen', () => {
  it('greets, shows an empty goal and streak, and says what to do first', async () => {
    await renderWithProviders(<TodayScreen />);
    expect(await screen.findByText(strings.streak.none)).toBeOnTheScreen();
    expect(screen.getByText(s.goalTitle)).toBeOnTheScreen();
    expect(screen.getByText('0/50')).toBeOnTheScreen();
    expect(screen.getByText(s.goalRemaining(50))).toBeOnTheScreen();
    expect(screen.getByText(s.dueNoDecks)).toBeOnTheScreen();
    expect(screen.getByText(s.recentEmpty)).toBeOnTheScreen();
    expect(screen.getByText(s.roadmapTitle)).toBeOnTheScreen();
    expect(screen.getByText(s.drugTitle)).toBeOnTheScreen();
    expect(screen.getByText(strings.disclaimer)).toBeOnTheScreen();
  });

  it('lists recent notes, decks and quizzes and opens them', async () => {
    const earlier = (minutes: number) => ({
      now: () => new Date(Date.UTC(2026, 9, 29, 10, minutes)).toISOString(),
    });
    const note = await createNote(mockDb, { ownerId: owner, title: 'SAMPLE note' }, earlier(1));
    const deck = await createDeck(mockDb, { ownerId: owner, title: 'SAMPLE deck' }, earlier(2));
    await renderWithProviders(<TodayScreen />);

    const deckRow = await screen.findByRole('button', {
      name: s.recentOpen('SAMPLE deck', s.recentKinds.deck),
    });
    const noteRow = screen.getByRole('button', {
      name: s.recentOpen('SAMPLE note', s.recentKinds.note),
    });
    await fireEvent.press(noteRow);
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/note/[id]',
      params: { id: note.id },
    });
    await fireEvent.press(deckRow);
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/deck/[id]',
      params: { id: deck.id },
    });
  });

  it('updates live after a review: goal, streak, level and the cards due', async () => {
    const deck = await createDeck(mockDb, { ownerId: owner, title: 'SAMPLE deck' });
    const cards = [];
    for (const n of [1, 2, 3]) {
      cards.push(await createCard(mockDb, { ownerId: owner, deckId: deck.id, draft: basic(n) }));
    }
    await renderWithProviders(<TodayScreen />);
    expect(await screen.findByText(s.dueTitle(3))).toBeOnTheScreen();
    expect(screen.getByText(s.dueMessage(3))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: s.startReviews }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/review/[scope]',
      params: { scope: 'all' },
    });

    // The student reviews two cards (as the review screen does: answer, then award XP).
    for (const card of cards.slice(0, 2)) {
      const [instance] = await listCardInstances(mockDb, card.id);
      await act(async () => {
        await answerCard(mockDb, { instanceId: instance.id, rating: 4 });
        await awardXp(mockDb, { ownerId: owner, source: 'review_card', sourceId: instance.id });
      });
    }
    expect(await screen.findByText(s.dueTitle(1))).toBeOnTheScreen();
    expect(screen.getByText('2/50')).toBeOnTheScreen();
    expect(screen.getByText(s.goalRemaining(48))).toBeOnTheScreen();

    // Enough XP for the day's streak (10) and the goal (50 + the bonus).
    await act(async () => {
      await awardXp(mockDb, { ownerId: owner, source: 'mock_exam', sourceId: 'm1' });
    });
    expect(await screen.findByText(strings.streak.label(1))).toBeOnTheScreen();
    expect(screen.getByText(s.goalDone)).toBeOnTheScreen();
    expect(
      await screen.findByText(strings.xp.levelLabel(2, strings.xp.titles.intern)),
    ).toBeOnTheScreen();
  });
});
