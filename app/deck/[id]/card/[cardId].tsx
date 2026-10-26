import { useLocalSearchParams } from 'expo-router';

import { CardEditorScreen } from '@/features/decks';

// The card editor. `cardId` "new" adds a card to the deck; any other id edits that card.
// A new card made from a note also gets `fromNote` (the note's id), `cardType` and `text`.
export default function CardEditorRoute() {
  const { id, cardId, fromNote, cardType, text } = useLocalSearchParams<{
    id: string;
    cardId: string;
    fromNote?: string;
    cardType?: string;
    text?: string;
  }>();
  return (
    <CardEditorScreen
      deckId={id}
      cardId={cardId}
      fromNote={fromNote ? { noteId: fromNote, type: cardType, text } : undefined}
    />
  );
}
