import { ScrollView } from 'react-native';

import { Text } from '@/components/ui';
import { DueNowCard } from '@/features/review';
import { strings } from '@/i18n/strings';

// Practice tab (PRODUCT_SPEC §5.2). "Due now" so far; drills and quick quizzes come later.
export default function PracticeScreen() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4">
      <DueNowCard />
      <Text variant="small" tone="muted" className="text-center">
        {strings.practice.comingSoon}
      </Text>
    </ScrollView>
  );
}
