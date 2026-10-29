import { useLocalSearchParams } from 'expo-router';

import { OnboardingScreen } from '@/features/onboarding';

// First-launch setup (task 2.8). `?mode=edit` re-runs it from the Me tab.
export default function OnboardingRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <OnboardingScreen edit={mode === 'edit'} />;
}
