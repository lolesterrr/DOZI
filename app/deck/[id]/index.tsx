import { useLocalSearchParams } from 'expo-router';

import { DeckScreen } from '@/features/decks';

// One deck and its cards. Opened from the Library or "+ Create → New deck".
export default function DeckRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DeckScreen id={id} />;
}
