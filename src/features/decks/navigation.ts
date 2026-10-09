import { router } from 'expo-router';

/** Opens the card editor: `cardId` "new" adds a card to the deck, any other id edits that card. */
export function openCardEditor(deckId: string, cardId: string) {
  router.push({ pathname: '/deck/[id]/card/[cardId]', params: { id: deckId, cardId } });
}
