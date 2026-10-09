import { and, asc, eq, isNull } from 'drizzle-orm';

import { cardInstances, cards, cardState, decks, type Card } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { CardStateValues, QueueEntry, QueueKind } from '@/features/srs/logic';
import { getCardState, type ReviewScope } from '@/features/srs/repo';

// What the review screen reads: one card instance with everything needed to show and schedule
// it, and the cards for cram mode. Answers, undo and bury go through `features/srs/repo.ts`.

export type ReviewItem = {
  instanceId: string;
  subKey: string;
  card: Card;
  deckId: string;
  deckTitle: string;
  desiredRetention: number;
  /** null = never reviewed. */
  state: CardStateValues | null;
};

/** One card instance ready to show, or null if it, its card or its deck has been deleted. */
export async function loadReviewItem(
  db: AppDatabase,
  instanceId: string,
): Promise<ReviewItem | null> {
  const [row] = await db
    .select({
      instanceId: cardInstances.id,
      subKey: cardInstances.subKey,
      card: cards,
      deckId: decks.id,
      deckTitle: decks.title,
      desiredRetention: decks.desiredRetention,
    })
    .from(cardInstances)
    .innerJoin(cards, eq(cards.id, cardInstances.cardId))
    .innerJoin(decks, eq(decks.id, cards.deckId))
    .where(
      and(
        eq(cardInstances.id, instanceId),
        isNull(cardInstances.deletedAt),
        isNull(cards.deletedAt),
        isNull(decks.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { ...row, state: await getCardState(db, instanceId) };
}

/**
 * Every card instance in a deck (or every deck) for cram mode, whether due or not, in the order
 * the cards were added. Suspended and deleted cards are left out; buried ones are included.
 */
export async function loadCramCards(
  db: AppDatabase,
  { ownerId, scope }: { ownerId: string; scope: ReviewScope },
): Promise<QueueEntry[]> {
  const rows = await db
    .select({
      instanceId: cardInstances.id,
      cardId: cards.id,
      deckId: cards.deckId,
      state: cardState.state,
    })
    .from(cardInstances)
    .innerJoin(cards, eq(cards.id, cardInstances.cardId))
    .innerJoin(decks, eq(decks.id, cards.deckId))
    .leftJoin(
      cardState,
      and(eq(cardState.cardInstanceId, cardInstances.id), isNull(cardState.deletedAt)),
    )
    .where(
      and(
        eq(cardInstances.ownerId, ownerId),
        isNull(cardInstances.deletedAt),
        isNull(cards.deletedAt),
        eq(cards.suspended, false),
        isNull(decks.deletedAt),
        scope === 'all' ? undefined : eq(decks.id, scope.deckId),
      ),
    )
    .orderBy(asc(cards.createdAt), asc(cards.id), asc(cardInstances.subKey));
  return rows.map(({ state, ...row }) => ({ ...row, kind: queueKind(state) }));
}

function queueKind(state: string | null): QueueKind {
  if (state === 'review') return 'review';
  if (state === 'learning' || state === 'relearning') return 'learning';
  return 'new';
}
