import { useLocalSearchParams } from 'expo-router';

import { NoteScreen } from '@/features/notes';

// One note in the editor. Opened from the Library or "+ Create → New note".
export default function NoteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NoteScreen id={id} />;
}
