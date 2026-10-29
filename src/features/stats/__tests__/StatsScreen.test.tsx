import { act, screen } from '@testing-library/react-native';

import { questionResponses, questions, quizAttempts } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { createCard, createDeck, listCardInstances } from '@/features/decks/repo';
import { awardXp } from '@/features/gamification/repo';
import { answerCard } from '@/features/srs/repo';
import { strings } from '@/i18n/strings';
import { createTestDatabase } from '@/test-utils/db';
import { renderWithProviders } from '@/test-utils/render';

import { StatsScreen } from '../components/StatsScreen';
import { loadStatsData } from '../repo';

const owner = 'owner-1';
let mockDb: AppDatabase;

jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: () => mockDb }));
jest.mock('@/features/profile/hooks', () => ({
  useProfile: () => ({
    loading: false,
    profile: { id: 'owner-1', timezone: 'Africa/Kampala', dailyGoalXp: 50 },
  }),
}));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    ...jest.requireActual('expo-router'),
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});

const s = strings.stats;
const field = (text: string) => ({ text, mediaIds: [] });
const basic = (n: number) => ({
  type: 'basic' as const,
  front: field(`SAMPLE question ${n}`),
  back: field(`SAMPLE answer ${n}`),
  extra: field(''),
});

beforeEach(() => {
  mockDb = createTestDatabase();
});

describe('Stats screen', () => {
  it('shows a friendly message before there is anything to chart', async () => {
    await renderWithProviders(<StatsScreen />);
    expect(await screen.findByText(s.emptyTitle)).toBeOnTheScreen();
  });

  it('charts real reviews, XP and decks from the database', async () => {
    const deck = await createDeck(mockDb, { ownerId: owner, title: 'SAMPLE antibiotics' });
    const card = await createCard(mockDb, {
      ownerId: owner,
      deckId: deck.id,
      draft: basic(1),
    });
    const [instance] = await listCardInstances(mockDb, card.id);
    await answerCard(mockDb, { instanceId: instance.id, rating: 3, durationMs: 4000 });
    await awardXp(mockDb, { ownerId: owner, source: 'review_card', sourceId: instance.id });

    const data = await loadStatsData(mockDb, owner);
    expect(data.reviews).toHaveLength(1);
    expect(data.due).toHaveLength(1); // the card now has a next review time
    expect(data.decks).toEqual([{ id: deck.id, title: 'SAMPLE antibiotics', cards: 1 }]);

    await renderWithProviders(<StatsScreen />);
    expect(await screen.findByText(s.activityTitle)).toBeOnTheScreen();
    expect(screen.getByText(s.remembered(100))).toBeOnTheScreen();
    expect(screen.getByText('SAMPLE antibiotics')).toBeOnTheScreen();
    expect(screen.getByText(s.deckDetail(1, 1, 0))).toBeOnTheScreen();
    expect(screen.getByText(s.accuracyEmpty)).toBeOnTheScreen();
    expect(screen.getByTestId('heatmap')).toBeOnTheScreen();
    await act(async () => {});
  });

  it('reads quiz accuracy by question type from finished attempts only', async () => {
    const at = '2026-10-29T08:00:00.000Z';
    const base = { ownerId: owner, createdAt: at, updatedAt: at };
    await mockDb.insert(questions).values({
      id: 'q1',
      ...base,
      type: 'sba',
      stemJson: '{}',
      payloadJson: '{}',
    });
    await mockDb.insert(quizAttempts).values([
      { id: 'a1', ...base, mode: 'practice', settingsJson: '{}', startedAt: at, finishedAt: at },
      { id: 'a2', ...base, mode: 'practice', settingsJson: '{}', startedAt: at, finishedAt: null },
    ]);
    const response = { ...base, questionId: 'q1', responseJson: '{}', maxScore: 1, timeMs: 3000 };
    await mockDb.insert(questionResponses).values([
      { id: 'r1', attemptId: 'a1', score: 1, isCorrect: true, ...response },
      { id: 'r2', attemptId: 'a2', score: 0, ...response },
    ]);
    const data = await loadStatsData(mockDb, owner);
    expect(data.quiz).toEqual([{ type: 'sba', score: 1, maxScore: 1, timeMs: 3000 }]);

    await renderWithProviders(<StatsScreen />);
    expect(await screen.findByText(strings.questions.types.sba)).toBeOnTheScreen();
    expect(screen.getByText(s.accuracyRow(1))).toBeOnTheScreen();
    await act(async () => {});
  });
});
