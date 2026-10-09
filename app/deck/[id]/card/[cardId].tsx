import { useLocalSearchParams } from 'expo-router';

import { CardEditorScreen } from '@/features/decks';

// The card editor. `cardId` "new" adds a card to the deck; any other id edits that card.
export default function CardEditorRoute() {
  const { id, cardId } = useLocalSearchParams<{ id: string; cardId: string }>();
  return <CardEditorScreen deckId={id} cardId={cardId} />;
}
