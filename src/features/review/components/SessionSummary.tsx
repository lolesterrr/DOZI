import { ScrollView, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { Dozi } from '@/features/mascot';
import { formatInterval } from '@/features/srs/logic';
import { strings } from '@/i18n/strings';

import {
  minutesSpent,
  summaryMood,
  type SessionSummary as Summary,
  type ReviewMode,
} from '../logic';

const s = strings.review.summary;

export type SessionSummaryProps = {
  summary: Summary;
  mode: ReviewMode;
  /** Review mode: when the next learning card comes back (ISO time), if any. */
  nextLearningDue: string | null;
  /** When the queue was last checked (ms), for "come back in 8m". */
  now: number;
  onCheckAgain: () => void;
  onDone: () => void;
};

/** End of a session: Dozi's reaction, cards reviewed, how many were remembered, time spent. */
export function SessionSummary({
  summary,
  mode,
  nextLearningDue,
  now,
  onCheckAgain,
  onDone,
}: SessionSummaryProps) {
  const mood = summaryMood(summary);
  const percent = summary.accuracy === null ? 0 : Math.round(summary.accuracy * 100);
  const comeBack =
    mode === 'review' && nextLearningDue ? formatInterval(Date.parse(nextLearningDue) - now) : null;
  return (
    <ScrollView contentContainerClassName="items-center gap-5 px-6 py-8">
      <Dozi mood={mood} size={120} />
      <Text variant="title" className="text-center">
        {mode === 'cram' ? s.cramTitle : s.title}
      </Text>
      <Text tone="muted" className="max-w-[340px] text-center">
        {s.messages[mood]}
      </Text>
      <View className="w-full flex-row gap-2">
        <Stat label={s.cards} value={String(summary.cards)} />
        <Stat label={s.remembered} value={s.percent(percent)} />
        <Stat label={s.time} value={s.minutes(minutesSpent(summary.timeMs))} />
      </View>
      {mode === 'cram' ? (
        <Text variant="small" tone="muted" className="text-center">
          {s.cramNote}
        </Text>
      ) : null}
      {comeBack ? (
        <View className="items-center gap-2">
          <Text variant="small" tone="muted" className="text-center">
            {s.comeBack(comeBack)}
          </Text>
          <Button label={s.checkAgain} variant="outline" onPress={onCheckAgain} />
        </View>
      ) : null}
      <Button label={s.done} size="lg" fullWidth onPress={onDone} />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="flex-1 items-center gap-1 rounded-lg border border-border bg-surface px-2 py-3"
    >
      <Text variant="heading">{value}</Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}
