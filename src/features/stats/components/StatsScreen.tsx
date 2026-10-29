import { ScrollView, View } from 'react-native';

import { Card, EmptyState, ProgressBar, Skeleton, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { BarChart as BarsIcon } from 'lucide-react-native';

import { useStats } from '../hooks';
import { formatStudyTime, type StatsView as StatsViewData } from '../logic';
import { BarChart } from './BarChart';
import { Heatmap } from './Heatmap';

const s = strings.stats;

function studyTime(ms: number): string {
  const { hours, minutes } = formatStudyTime(ms);
  if (hours === 0 && minutes === 0) return s.lessThanMinute;
  return hours === 0 ? s.minutes(minutes) : s.hoursMinutes(hours, minutes);
}

/** Stats (PRODUCT_SPEC §8.5): activity, XP, reviews, time, forecast, quiz accuracy, decks. */
export function StatsScreen() {
  const { loading, stats } = useStats();
  if (loading || !stats) {
    return (
      <View className="flex-1 gap-4 bg-background p-4">
        <Skeleton height={160} />
        <Skeleton height={128} />
      </View>
    );
  }
  if (stats.empty) {
    return (
      <View className="flex-1 justify-center bg-background">
        <EmptyState icon={BarsIcon} title={s.emptyTitle} message={s.emptyMessage} />
      </View>
    );
  }
  return <StatsContent stats={stats} />;
}

export function StatsContent({ stats }: { stats: StatsViewData }) {
  const { reviews, forecast } = stats;
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4 pb-10">
      <Card className="gap-3">
        <Text variant="heading">{s.activityTitle}</Text>
        <Text variant="small" tone="muted">
          {s.activitySummary(stats.activeDays, stats.heatmap.length)}
        </Text>
        <Heatmap grid={stats.heatmap} />
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{s.xpTitle}</Text>
        <Text variant="small" tone="muted">
          {s.xpSummary(stats.xpTotal14, stats.xpDays.length)}
        </Text>
        <BarChart
          data={stats.xpDays}
          accessibilityLabel={s.chartLabel(
            s.xpTitle,
            s.xpSummary(stats.xpTotal14, stats.xpDays.length),
          )}
        />
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{s.reviewedTitle}</Text>
        <View className="flex-row gap-2">
          <Figure label={s.today} value={String(reviews.today)} />
          <Figure label={s.last7} value={String(reviews.last7)} />
          <Figure label={s.allTime} value={String(reviews.total)} />
        </View>
        <Text variant="small" tone="muted">
          {reviews.rememberedPercent === null
            ? s.noReviews
            : s.remembered(reviews.rememberedPercent)}
        </Text>
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{s.timeTitle}</Text>
        <View className="flex-row gap-2">
          <Figure label={s.timeToday} value={studyTime(stats.timeMsToday)} />
          <Figure label={s.timeWeek} value={studyTime(stats.timeMsLast7)} />
        </View>
        <Text variant="small" tone="muted">
          {s.timeAll}: {studyTime(stats.timeMs)}
        </Text>
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{s.forecastTitle}</Text>
        {forecast.total === 0 ? (
          <Text variant="small" tone="muted">
            {s.forecastEmpty}
          </Text>
        ) : (
          <>
            <Text variant="small" tone="muted">
              {s.forecastSummary(forecast.total, forecast.overdue)}
            </Text>
            <BarChart
              data={forecast.days}
              highlight="first"
              startLabel={s.forecastStart}
              endLabel={s.forecastEnd}
              accessibilityLabel={s.chartLabel(
                s.forecastTitle,
                s.forecastSummary(forecast.total, forecast.overdue),
              )}
            />
          </>
        )}
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{s.accuracyTitle}</Text>
        {stats.quizByType.length === 0 ? (
          <Text variant="small" tone="muted">
            {s.accuracyEmpty}
          </Text>
        ) : (
          stats.quizByType.map((row) => (
            <MeterRow
              key={row.type}
              label={
                strings.questions.types[row.type as keyof typeof strings.questions.types] ??
                row.type
              }
              detail={s.accuracyRow(row.answered)}
              percent={row.percent}
            />
          ))
        )}
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{s.decksTitle}</Text>
        {stats.decks.length === 0 ? (
          <Text variant="small" tone="muted">
            {s.decksEmpty}
          </Text>
        ) : (
          stats.decks.map((deck) => (
            <MeterRow
              key={deck.id}
              label={deck.title}
              detail={s.deckDetail(deck.cards, deck.reviews, deck.due)}
              percent={deck.rememberedPercent}
              emptyText={s.deckNoReviews}
              percentText={
                deck.rememberedPercent === null
                  ? undefined
                  : s.deckRemembered(deck.rememberedPercent)
              }
            />
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="flex-1 items-center gap-1 rounded-lg bg-surface-muted px-2 py-3"
    >
      <Text variant="heading">{value}</Text>
      <Text variant="caption" tone="muted" className="text-center">
        {label}
      </Text>
    </View>
  );
}

/** A label, a bar and the percentage in words (never the bar alone). */
function MeterRow({
  label,
  detail,
  percent,
  percentText,
  emptyText,
}: {
  label: string;
  detail: string;
  percent: number | null;
  percentText?: string;
  emptyText?: string;
}) {
  return (
    <View
      className="gap-1"
      accessible
      accessibilityLabel={`${label}. ${detail}. ${percentText ?? (percent === null ? (emptyText ?? '') : s.percent(percent))}`}
    >
      <View className="flex-row items-baseline justify-between gap-2">
        <Text variant="bodyStrong" className="flex-1" numberOfLines={2}>
          {label}
        </Text>
        <Text variant="bodyStrong">
          {percentText ?? (percent === null ? (emptyText ?? '') : s.percent(percent))}
        </Text>
      </View>
      <ProgressBar
        value={(percent ?? 0) / 100}
        tone={percent !== null && percent >= 70 ? 'success' : 'primary'}
      />
      <Text variant="small" tone="muted">
        {detail}
      </Text>
    </View>
  );
}
