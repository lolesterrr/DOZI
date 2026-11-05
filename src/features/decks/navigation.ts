import { router } from 'expo-router';

import type { NoteCardType } from '@/features/notes/makeCard';

/** A new card started from text selected in a note (task 1.13). */
export type CardFromNote = { noteId: string; type: NoteCardType; text: string };

/**
 * Opens the card editor: `cardId` "new" adds a card to the deck, any other id edits that card.
 * `fromNote` starts the new card with text from a note and links the card to it. `tag` starts a
 * new card with that card tag (adding cards while the deck is filtered by it).
 */
export function openCardEditor(
  deckId: string,
  cardId: string,
  fromNote?: CardFromNote,
  tag?: string | null,
) {
  const params: Record<string, string> = fromNote
    ? {
        id: deckId,
        cardId,
        fromNote: fromNote.noteId,
        cardType: fromNote.type,
        text: fromNote.text,
      }
    : { id: deckId, cardId };
  if (tag) params.tag = tag;
  router.push({ pathname: '/deck/[id]/card/[cardId]', params });
}
