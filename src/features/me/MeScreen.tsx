import { router } from 'expo-router';
import { BarChart3, ChevronRight, SlidersHorizontal } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui';
import { AchievementGallery } from '@/features/gamification/components/AchievementGallery';
import { XpSummary } from '@/features/gamification/components/XpSummary';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

/** The Me tab: level, streak and daily goal, then the badge gallery. Settings come later. */
export function MeScreen() {
  const { colors } = useTheme();
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 px-4 py-4">
      <View className="gap-3">
        <Text variant="heading" accessibilityRole="header">
          {strings.me.progressTitle}
        </Text>
        <XpSummary />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings.stats.open}
        accessibilityHint={strings.stats.openHint}
        onPress={() => router.push('/stats')}
        className="min-h-touch flex-row items-center gap-3 rounded-lg border border-border bg-surface p-4 active:opacity-80"
      >
        <BarChart3 color={colors.primary} size={24} />
        <View className="flex-1">
          <Text variant="bodyStrong">{strings.stats.open}</Text>
          <Text variant="small" tone="muted">
            {strings.stats.openHint}
          </Text>
        </View>
        <ChevronRight color={colors['fg-muted']} size={20} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings.me.redoSetup}
        accessibilityHint={strings.me.redoSetupHint}
        onPress={() => router.push({ pathname: '/onboarding', params: { mode: 'edit' } })}
        className="min-h-touch flex-row items-center gap-3 rounded-lg border border-border bg-surface p-4 active:opacity-80"
      >
        <SlidersHorizontal color={colors.primary} size={24} />
        <View className="flex-1">
          <Text variant="bodyStrong">{strings.me.redoSetup}</Text>
          <Text variant="small" tone="muted">
            {strings.me.redoSetupHint}
          </Text>
        </View>
        <ChevronRight color={colors['fg-muted']} size={20} />
      </Pressable>
      <AchievementGallery />
    </ScrollView>
  );
}
