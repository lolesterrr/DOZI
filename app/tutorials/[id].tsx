import { useLocalSearchParams } from 'expo-router';

import { TutorialPlayerScreen } from '@/features/tutorials';

// One tutorial video.
export default function TutorialRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TutorialPlayerScreen id={id} />;
}
