import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { cards, decks, type Card, type Deck } from '@/db/schema';
import { useProfile } from '@/features/profile/hooks';

import type { CardDraft, DeckSettings } from './logic';
import * as repo from './repo';

/** Every deck, A–Z, kept up to date. */
export function useDecks() {
  const db = useDatabase();
  const ownerId = useProfile().profile?.id ?? '';
  const { data } = useLiveQuery(
    db
      .select()
      .from(decks)
      .where(and(eq(decks.ownerId, ownerId), isNull(decks.deletedAt)))
      .orderBy(asc(decks.title)),
    [ownerId],
  );
  return data;
}

/** One deck (including a deleted one, so the screen can say it's gone). */
export function useDeck(id: string) {
  const db = useDatabase();
  const { data, updatedAt } = useLiveQuery(
    db.select().from(decks).where(eq(decks.id, id)).limit(1),
    [id],
  );
  return { deck: data[0] as Deck | undefined, loading: updatedAt === undefined };
}

/** A deck's cards, oldest first, kept up to date. */
export function useDeckCards(deckId: string) {
  const db = useDatabase();
  const { data } = useLiveQuery(
    db
      .select()
      .from(cards)
      .where(and(eq(cards.deckId, deckId), isNull(cards.deletedAt)))
      .orderBy(asc(cards.createdAt), asc(cards.id)),
    [deckId],
  );
  return data;
}

/** One card (including a deleted one). */
export function useCard(id: string) {
  const db = useDatabase();
  const { data, updatedAt } = useLiveQuery(
    db.select().from(cards).where(eq(cards.id, id)).limit(1),
    [id],
  );
  return { card: data[0] as Card | undefined, loading: updatedAt === undefined };
}

/** Deck and card changes, bound to the database and the profile. */
export function useDeckActions() {
  const db = useDatabase();
  const ownerId = useProfile().profile?.id ?? '';
  return useMemo(
    () => ({
      createDeck: (title: string, folderId: string | null = null) =>
        repo.createDeck(db, { ownerId, folderId, title }),
      renameDeck: (id: string, title: string) => repo.renameDeck(db, id, title),
      setDescription: (id: string, description: string) =>
        repo.setDeckDescription(db, id, description),
      updateSettings: (id: string, settings: DeckSettings) =>
        repo.updateDeckSettings(db, id, settings),
      setPinned: (id: string, pinned: boolean) => repo.setDeckPinned(db, id, pinned),
      moveDeck: (id: string, folderId: string | null) => repo.moveDeck(db, id, folderId),
      deleteDeck: (id: string) => repo.deleteDeck(db, id),
      restoreDeck: (id: string, deletedAt: string) => repo.restoreDeck(db, id, deletedAt),
      createCard: (deckId: string, draft: CardDraft) =>
        repo.createCard(db, { ownerId, deckId, draft }),
      updateCard: (id: string, draft: CardDraft) => repo.updateCard(db, id, draft),
      deleteCard: (id: string) => repo.deleteCard(db, id),
      restoreCard: (id: string, deletedAt: string) => repo.restoreCard(db, id, deletedAt),
      setCardSuspended: (id: string, suspended: boolean) =>
        repo.setCardSuspended(db, id, suspended),
    }),
    [db, ownerId],
  );
}

export type DeckActions = ReturnType<typeof useDeckActions>;
