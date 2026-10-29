import { router } from 'expo-router';
import {
  BookOpen,
  ChevronRight,
  Compass,
  FlaskConical,
  Flame,
  Layers,
  NotebookPen,
  Pill,
} from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, ProgressRing, Text } from '@/components/ui';
import { DoziSpeech } from '@/features/mascot';
import { openQuiz } from '@/features/quizzes/navigation';
import { openReview } from '@/features/review/navigation';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { useToday, type TodayData } from '../hooks';
import type { RecentItem, RecentKind } from '../logic';

const s = strings.today;

/** The Today tab (PRODUCT_SPEC §2): Dozi's greeting, goal and streak, reviews due, recent items. */
export function TodayScreen() {
  const data = useToday();
  return (
    <TodayView data={data} onStartReviews={() => openReview('all')} onOpenRecent={openRecent} />
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
};

/** What the screen draws, from plain data (so it is easy to test). */
export function TodayView({ data, onStartReviews, onOpenRecent }: TodayViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-background"
      // Room at the bottom for the floating "+ Create" button.
      contentContainerClassName="gap-4 px-4 pt-4"
      contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
    >
      <DoziSpeech mood={data.greeting.mood} message={data.greeting.message} size={80} />
      <ProgressCard data={data} />
      <DueCard data={data} onStart={onStartReviews} />
      <RecentCard items={data.recent} onOpen={onOpenRecent} />
      <SoonCard icon={Compass} title={s.roadmapTitle} message={s.roadmapSoon} />
      <SoonCard icon={Pill} title={s.drugTitle} message={s.drugSoon} />
      <Text variant="caption" tone="muted" className="pt-2 text-center">
        {strings.disclaimer}
      </Text>
      {__DEV__ ? <DevLinks /> : null}
    </ScrollView>
  );
}

function ProgressCard({ data }: { data: TodayData }) {
  const { colors } = useTheme();
  const { goal, streak, level } = data;
  const title = strings.xp.titles[level.title];
  return (
    <Card className="flex-row items-center gap-4">
      <ProgressRing
        value={goal.fraction}
        size={92}
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
        <View
          className="flex-row items-center gap-2"
          accessible
          accessibilityLabel={streakLabel(streak.current)}
        >
          <Flame color={streak.current > 0 ? colors.accent : colors['fg-muted']} size={22} />
          <Text variant="bodyStrong">
            {streak.current > 0 ? strings.streak.label(streak.current) : strings.streak.none}
          </Text>
        </View>
        <Text variant="small" tone="muted">
          {strings.xp.levelLabel(level.level, title)}
        </Text>
      </View>
    </Card>
  );
}

function streakLabel(days: number): string {
  return days > 0 ? strings.streak.label(days) : strings.streak.none;
}

function DueCard({ data, onStart }: { data: TodayData; onStart: () => void }) {
  const { colors } = useTheme();
  const { due, deckCount } = data;
  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-soft">
          <Layers color={colors['on-primary-soft']} size={22} />
        </View>
        <Text variant="heading" className="flex-1">
          {s.dueTitle(deckCount === 0 ? null : due)}
        </Text>
      </View>
      <Text tone="muted" accessibilityLiveRegion="polite">
        {deckCount === 0 ? s.dueNoDecks : due === null ? s.dueCounting : s.dueMessage(due)}
      </Text>
      {deckCount > 0 && due ? <Button label={s.startReviews} onPress={onStart} /> : null}
    </Card>
  );
}

const recentIcons = { note: NotebookPen, deck: Layers, quiz: FlaskConical } as const;

function RecentCard({
  items,
  onOpen,
}: {
  items: RecentItem[];
  onOpen: (item: RecentItem) => void;
}) {
  const { colors } = useTheme();
  return (
    <Card className="gap-1">
      <Text variant="heading" className="pb-1">
        {s.recentTitle}
      </Text>
      {items.length === 0 ? (
        <Text tone="muted">{s.recentEmpty}</Text>
      ) : (
        items.map((item) => {
          const Icon = recentIcons[item.kind];
          const kind = s.recentKinds[item.kind as RecentKind];
          return (
            <Pressable
              key={`${item.kind}-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={s.recentOpen(item.title, kind)}
              onPress={() => onOpen(item)}
              className="min-h-touch flex-row items-center gap-3 rounded-md py-2 active:bg-surface-muted"
            >
              <Icon color={colors.primary} size={20} />
              <View className="flex-1">
                <Text numberOfLines={1}>{item.title}</Text>
                <Text variant="caption" tone="muted">
                  {kind}
                </Text>
              </View>
              <ChevronRight color={colors['fg-muted']} size={18} />
            </Pressable>
          );
        })
      )}
    </Card>
  );
}

function SoonCard({
  icon: Icon,
  title,
  message,
}: {
  icon: typeof BookOpen;
  title: string;
  message: string;
}) {
  const { colors } = useTheme();
  return (
    <Card className="flex-row items-center gap-3 opacity-80">
      <Icon color={colors['fg-muted']} size={22} />
      <View className="flex-1">
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" tone="muted">
          {message}
        </Text>
      </View>
      <Text variant="caption" tone="muted">
        {s.comingSoon}
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
