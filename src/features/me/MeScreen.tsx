import { router, type Href } from 'expo-router';
import {
  BarChart3,
  CalendarClock,
  PlayCircle,
  Settings,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import {
  Blob,
  IconButton,
  PressableCard,
  ScreenHeader,
  SectionTitle,
  Text,
  type DoodleTint,
} from '@/components/ui';
import { AchievementGallery } from '@/features/gamification/components/AchievementGallery';
import { XpSummary } from '@/features/gamification/components/XpSummary';
import { strings } from '@/i18n/strings';

type Tile = { label: string; hint: string; icon: LucideIcon; tint: DoodleTint; href: Href };

const tiles: Tile[] = [
  {
    label: strings.stats.open,
    hint: strings.stats.openHint,
    icon: BarChart3,
    tint: 'teal',
    href: '/stats',
  },
  {
    label: strings.me.timetable,
    hint: strings.me.timetableHint,
    icon: CalendarClock,
    tint: 'coral',
    href: '/timetable',
  },
  {
    label: strings.me.tutorials,
    hint: strings.me.tutorialsHint,
    icon: PlayCircle,
    tint: 'violet',
    href: '/tutorials',
  },
  {
    label: strings.me.redoSetup,
    hint: strings.me.redoSetupHint,
    icon: SlidersHorizontal,
    tint: 'green',
    href: { pathname: '/onboarding', params: { mode: 'edit' } },
  },
];

/** The Me tab: level, streak and daily goal, shortcuts as doodle tiles, then the badges. */
export function MeScreen() {
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={strings.me.title}
        right={
          <IconButton
            icon={Settings}
            variant="soft"
            accessibilityLabel={strings.me.settings}
            accessibilityHint={strings.me.settingsHint}
            onPress={() => router.push('/settings')}
          />
        }
      />
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10 pt-3">
        <View className="gap-3">
          <SectionTitle title={strings.me.progressTitle} />
          <XpSummary />
        </View>
        <View className="flex-row flex-wrap justify-between gap-y-5">
          {tiles.map((tile, index) => (
            <PressableCard
              key={tile.label}
              layer={index % 3 === 0 ? 'primary' : 'accent'}
              accessibilityLabel={tile.label}
              accessibilityHint={tile.hint}
              onPress={() => router.push(tile.href)}
              className="min-h-[136px] w-[48%] gap-2 p-3"
            >
              <Blob icon={tile.icon} tint={tile.tint} index={index} size={46} />
              <Text variant="bodyStrong">{tile.label}</Text>
              <Text variant="caption" tone="muted" numberOfLines={3}>
                {tile.hint}
              </Text>
            </PressableCard>
          ))}
        </View>
        <AchievementGallery />
      </ScrollView>
    </View>
  );
}
