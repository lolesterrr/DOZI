import { ScrollView, View } from 'react-native';

import { ScreenHeader, Text } from '@/components/ui';
import { DueNowCard } from '@/features/review';
import { HeaderSearchButton } from '@/features/shell';
import { strings } from '@/i18n/strings';

// Practice tab (PRODUCT_SPEC §5.2). "Due now" so far; drills and quick quizzes come later.
export default function PracticeScreen() {
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={strings.tabs.practice} right={<HeaderSearchButton />} />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-8 pt-3">
        <DueNowCard />
        <Text variant="small" tone="muted" className="text-center">
          {strings.practice.comingSoon}
        </Text>
      </ScrollView>
    </View>
  );
}
