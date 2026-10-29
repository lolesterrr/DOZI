import { ScrollView, View } from 'react-native';

import { Text } from '@/components/ui';
import { AchievementGallery } from '@/features/gamification/components/AchievementGallery';
import { XpSummary } from '@/features/gamification/components/XpSummary';
import { strings } from '@/i18n/strings';

/** The Me tab: level, streak and daily goal, then the badge gallery. Settings come later. */
export function MeScreen() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 px-4 py-4">
      <View className="gap-3">
        <Text variant="heading" accessibilityRole="header">
          {strings.me.progressTitle}
        </Text>
        <XpSummary />
      </View>
      <AchievementGallery />
    </ScrollView>
  );
}
