import { Circle, CircleCheck } from 'lucide-react-native';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Button, Confetti, ProgressBar, Text } from '@/components/ui';
import { Dozi } from '@/features/mascot';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import type { KeyPointProgress } from '../keyPoints';

const t = strings.notes.keyPoints;

/** "Key points in your cards: 4 of 9" under the note title, with a bar. Tap for the list. */
export function KeyPointsMeter({
  progress,
  onPress,
}: {
  progress: Pick<KeyPointProgress, 'covered' | 'total'>;
  onPress: () => void;
}) {
  if (progress.total === 0) return null;
  const label = t.meter(progress.covered, progress.total);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t.meterHint}
      onPress={onPress}
      className="min-h-touch justify-center gap-1 active:opacity-80"
    >
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <ProgressBar
        value={progress.covered / progress.total}
        tone={progress.covered === progress.total ? 'success' : 'accent'}
      />
    </Pressable>
  );
}

/** Each key point with a tick (in your cards) or an empty circle (not yet), in words too. */
export function KeyPointsList({ progress }: { progress: KeyPointProgress }) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <View className="gap-3 pb-2">
      <Text variant="small" tone="muted">
        {progress.total > 0 ? t.hint : t.none}
      </Text>
      <ScrollView style={{ maxHeight: height * 0.5 }} contentContainerClassName="gap-1">
        {progress.points.map(({ point, covered }, i) => (
          <View
            key={i}
            accessible
            accessibilityLabel={covered ? t.covered(point.title) : t.notCovered(point.title)}
            className="min-h-touch flex-row items-center gap-3 px-1"
          >
            {covered ? (
              <CircleCheck size={22} color={colors.success} />
            ) : (
              <Circle size={22} color={colors['fg-muted']} />
            )}
            <Text variant="body" className="flex-1" numberOfLines={2}>
              {point.title}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** "What this note earned": shown once, when the last key point goes into a card. */
export function NoteEarned({
  cards,
  points,
  onDone,
}: {
  cards: number;
  points: number;
  onDone: () => void;
}) {
  return (
    <View className="items-center gap-3 pb-2">
      <Confetti height={280} />
      <Dozi mood="celebrating" size={112} />
      <Text variant="body" className="text-center">
        {t.earnedMessage}
      </Text>
      <View className="flex-row flex-wrap justify-center gap-2">
        <Stamp label={t.earnedCards(cards)} />
        <Stamp label={t.earnedPoints(points)} />
      </View>
      <Button label={t.earnedDone} onPress={onDone} fullWidth />
    </View>
  );
}

function Stamp({ label }: { label: string }) {
  return (
    <View className="rounded-full border-2 border-outline bg-surface px-3 py-1">
      <Text variant="small" className="font-body-semibold">
        {label}
      </Text>
    </View>
  );
}
