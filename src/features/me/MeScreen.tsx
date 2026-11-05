import { router, type Href } from 'expo-router';
import {
  BarChart3,
  CalendarClock,
  PlayCircle,
  Settings,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import {
  Blob,
  cn,
  IconButton,
  PressableCard,
  ScreenHeader,
  SectionTitle,
  Text,
  useOneColumn,
  type DoodleTint,
} from '@/components/ui';
import { useAuthSession } from '@/features/account';
import { AchievementGallery } from '@/features/gamification/components/AchievementGallery';
import { XpSummary } from '@/features/gamification/components/XpSummary';
import { HeaderSearchButton } from '@/features/shell';
import { strings } from '@/i18n/strings';
import { isSupabaseConfigured } from '@/lib/supabase';

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
  const oneColumn = useOneColumn();
  const { session } = useAuthSession();
  // Sign-in (task 3.2) only shows when the app is connected to Supabase.
  const shown: Tile[] = isSupabaseConfigured
    ? [
        {
          label: strings.me.account,
          hint: session
            ? strings.me.accountSignedInHint(session.user.email ?? '')
            : strings.me.accountSignedOutHint,
          icon: UserRound,
          tint: 'amber',
          href: '/account',
        },
        ...tiles,
      ]
    : tiles;
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={strings.me.title}
        right={<HeaderSearchButton />}
        left={
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
          {shown.map((tile, index) => (
            <PressableCard
              key={tile.label}
              accessibilityLabel={tile.label}
              accessibilityHint={tile.hint}
              onPress={() => router.push(tile.href)}
              className={cn('min-h-[136px] gap-2 p-3', oneColumn ? 'w-full' : 'w-[48%]')}
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
