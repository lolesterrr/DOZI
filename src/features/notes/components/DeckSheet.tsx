import { Layers, Plus } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/ui';
import { useDecks } from '@/features/decks/hooks';
import { cleanDeckTitle, DECK_TITLE_MAX } from '@/features/decks/logic';
import { SheetAction } from '@/features/library/components/SheetAction';
import { strings } from '@/i18n/strings';

const s = strings.notes;

/** A deck named after the note, for its cards. */
export function noteDeckTitle(noteTitle: string): string {
  return cleanDeckTitle(noteTitle).slice(0, DECK_TITLE_MAX).trim();
}

/**
 * Which deck a card from this note goes into: the deck used last time first, then the others
 * A–Z, and "New deck “<note title>”" unless a deck already has that name.
 */
export function DeckSheet({
  hint = s.makeCard.hint,
  newDeckTitle,
  lastDeckId,
  onPick,
}: {
  hint?: string;
  newDeckTitle: string;
  lastDeckId: string | null;
  onPick: (deckId: string | null) => void;
}) {
  const decks = useDecks();
  const last = decks.find((deck) => deck.id === lastDeckId);
  const ordered = last ? [last, ...decks.filter((deck) => deck !== last)] : decks;
  const nameTaken = decks.some(
    (deck) => deck.title.toLocaleLowerCase() === newDeckTitle.toLocaleLowerCase(),
  );
  return (
    <View className="gap-2 pb-2">
      <Text variant="small" tone="muted">
        {hint}
      </Text>
      <ScrollView style={{ maxHeight: 400 }}>
        {nameTaken ? null : (
          <SheetAction
            icon={Plus}
            label={s.makeCard.newDeck(newDeckTitle)}
            onPress={() => onPick(null)}
          />
        )}
        {ordered.map((deck) => (
          <SheetAction
            key={deck.id}
            icon={Layers}
            label={deck === last ? s.makeCard.lastUsed(deck.title) : deck.title}
            onPress={() => onPick(deck.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
