import { router } from 'expo-router';
import { Compass, Flame, Layers, Pill, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Blob,
  Button,
  Card,
  cn,
  Hanger,
  PressableCard,
  ProgressRing,
  ScreenHeader,
  SectionTitle,
  Text,
  useOneColumn,
  type DoodleTint,
} from '@/components/ui';
import { kindIcons, kindTints } from '@/features/library/kinds';
import { Dozi } from '@/features/mascot';
import { openQuiz } from '@/features/quizzes/navigation';
import { openReview } from '@/features/review/navigation';
import { HeaderSearchButton } from '@/features/shell';
import { TodayTimetableCard } from '@/features/timetable';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { useToday, type TodayData } from '../hooks';
import type { RecentItem } from '../logic';
import { WeekStrip } from './WeekStrip';

const s = strings.today;

/** How many recent items the "Pick up again" grid shows. */
const RECENT_TILES = 4;

/** The Today tab (PRODUCT_SPEC §2): Dozi's greeting, goal and streak, reviews due, recent items. */
export function TodayScreen() {
  const data = useToday();
  return (
    <TodayView
      data={data}
      onStartReviews={() => openReview('all')}
      onOpenRecent={openRecent}
      timetable={<TodayTimetableCard />}
    />
  );
}

function openRecent(item: RecentItem) {
  if (item.kind === 'note') router.push({ pathname: '/note/[id]', params: { id: item.id } });
  else if (item.kind === 'deck') router.push({ pathname: '/deck/[id]', params: { id: item.id } });
  else openQuiz(item.id);
}

export type TodayViewProps = {
  data: TodayData;
  onStartReviews: () => void;
  onOpenRecent: (item: RecentItem) => void;
  /** The timetable card (it reads the database itself, so tests can leave it out). */
  timetable?: ReactNode;
};

/** What the screen draws, from plain data (so it is easy to test). */
export function TodayView({ data, onStartReviews, onOpenRecent, timetable }: TodayViewProps) {
  const insets = useSafeAreaInsets();
  const oneColumn = useOneColumn();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={strings.tabs.index}
        left={<StreakBadge days={data.streak.current} />}
        right={<HeaderSearchButton />}
      />
      <ScrollView
        className="flex-1"
        // Room at the bottom for the floating "+ Create" button.
        contentContainerClassName="gap-5 px-4 pt-3"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
      >
        <HeroCard data={data} />
        <WeekStrip week={data.week} />
        <DueCard data={data} onStart={onStartReviews} />
        {timetable}
        <RecentGrid
          items={data.recent.slice(0, RECENT_TILES)}
          onOpen={onOpenRecent}
          oneColumn={oneColumn}
        />
        <SectionTitle title={s.comingSoon} />
        <View className={oneColumn ? 'gap-5' : 'flex-row gap-3'}>
          <SoonTile
            icon={Compass}
            tint="violet"
            index={1}
            title={s.roadmapTitle}
            message={s.roadmapSoon}
          />
          <SoonTile icon={Pill} tint="rose" index={2} title={s.drugTitle} message={s.drugSoon} />
        </View>
        <Text variant="caption" tone="muted" className="pt-2 text-center">
          {strings.disclaimer}
        </Text>
        {__DEV__ ? <DevLinks /> : null}
      </ScrollView>
    </View>
  );
}

/** The streak in the top bar's left corner: a flame and the number of days. */
function StreakBadge({ days }: { days: number }) {
  const { colors } = useTheme();
  const label = days > 0 ? strings.streak.label(days) : strings.streak.none;
  return (
    <View
      accessible
      accessibilityLabel={label}
      className="min-h-touch min-w-touch flex-row items-center justify-center gap-1 rounded-xl border-2 border-outline bg-accent-soft px-2"
    >
      <Flame color={colors['on-accent-soft']} size={20} />
      <Text variant="bodyStrong" tone="inherit" className="text-on-accent-soft">
        {days}
      </Text>
    </View>
  );
}

/** Pierre's hello, then the daily goal ring beside the streak and level. */
function HeroCard({ data }: { data: TodayData }) {
  const { colors } = useTheme();
  const { goal, streak, level, greeting } = data;
  const title = strings.xp.titles[level.title];
  return (
    <Card className="gap-4">
      <View className="flex-row items-center gap-3">
        <Dozi mood={greeting.mood} size={72} />
        <Text variant="subheading" className="flex-1">
          {greeting.message}
        </Text>
      </View>
      <View className="flex-row items-center gap-4">
        <ProgressRing
          value={goal.fraction}
          size={96}
          strokeWidth={11}
          tone={goal.met ? 'success' : 'primary'}
          accessibilityLabel={s.goalRingLabel(goal.xp, goal.goal)}
        >
          <Text variant="bodyStrong">{goal.goal > 0 ? `${goal.xp}/${goal.goal}` : goal.xp}</Text>
          <Text variant="caption" tone="muted">
            XP
          </Text>
        </ProgressRing>
        <View className="flex-1 gap-2">
          <View>
            <Text variant="bodyStrong">{s.goalTitle}</Text>
            <Text variant="small" tone="muted">
              {goal.goal <= 0 ? s.noGoal : goal.met ? s.goalDone : s.goalRemaining(goal.remaining)}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5" accessible>
            <Flame color={streak.current > 0 ? colors.accent : colors['fg-muted']} size={18} />
            <Text variant="label">
              {streak.current > 0 ? strings.streak.label(streak.current) : strings.streak.none}
            </Text>
          </View>
          <Text variant="small" tone="muted">
            {strings.xp.levelLabel(level.level, title)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

/** The cards waiting for review, with the big start button. */
function DueCard({ data, onStart }: { data: TodayData; onStart: () => void }) {
  const { due, deckCount } = data;
  return (
    <Card layer="primary" className="gap-3">
      <View className="flex-row items-center gap-3">
        <Blob icon={Layers} tint="teal" index={0} size={52} />
        <Text variant="heading" className="flex-1">
          {s.dueTitle(deckCount === 0 ? null : due)}
        </Text>
      </View>
      <Text tone="muted" accessibilityLiveRegion="polite">
        {deckCount === 0 ? s.dueNoDecks : due === null ? s.dueCounting : s.dueMessage(due)}
      </Text>
      {deckCount > 0 && due ? (
        <Button label={s.startReviews} size="lg" icon={Layers} onPress={onStart} />
      ) : null}
    </Card>
  );
}

/** "Pick up again": recent notes, decks and quizzes as tiles hanging from the title. */
function RecentGrid({
  items,
  onOpen,
  oneColumn,
}: {
  items: RecentItem[];
  onOpen: (item: RecentItem) => void;
  oneColumn: boolean;
}) {
  return (
    <View className="gap-2">
      <SectionTitle title={s.recentTitle} />
      {items.length === 0 ? (
        <Card layer="none">
          <Text tone="muted">{s.recentEmpty}</Text>
        </Card>
      ) : (
        <View className="flex-row flex-wrap justify-between gap-y-4">
          {items.map((item, index) => {
            const kind = s.recentKinds[item.kind];
            return (
              <View
                key={`${item.kind}-${item.id}`}
                className={cn('relative mt-4', oneColumn ? 'w-full' : 'w-[48%]')}
              >
                <Hanger />
                <PressableCard
                  layer={kindTints[item.kind]}
                  accessibilityLabel={s.recentOpen(item.title, kind)}
                  onPress={() => onOpen(item)}
                  className="min-h-[128px] gap-2 p-3"
                >
                  <Blob
                    icon={kindIcons[item.kind]}
                    tint={kindTints[item.kind]}
                    index={index}
                    size={44}
                  />
                  <Text variant="bodyStrong" numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {kind}
                  </Text>
                </PressableCard>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function SoonTile({
  icon,
  tint,
  index,
  title,
  message,
}: {
  icon: LucideIcon;
  tint: DoodleTint;
  index: number;
  title: string;
  message: string;
}) {
  return (
    <Card layer="none" className="flex-1 gap-2 p-3">
      <Blob icon={icon} tint={tint} index={index} size={40} />
      <Text variant="bodyStrong">{title}</Text>
      <Text variant="caption" tone="muted" numberOfLines={3}>
        {message}
      </Text>
    </Card>
  );
}

/** Developer-only shortcuts to the check screens. Not shown in release builds. */
function DevLinks() {
  return (
    <View className="gap-1 pt-2">
      <Button label={s.openGallery} variant="outline" onPress={() => router.push('/dev/ui')} />
      <Button label={s.openMascot} variant="ghost" onPress={() => router.push('/dev/mascot')} />
      <Button label={s.openDatabase} variant="ghost" onPress={() => router.push('/dev/db')} />
      <Button label={s.openMedia} variant="ghost" onPress={() => router.push('/dev/media')} />
    </View>
  );
}
