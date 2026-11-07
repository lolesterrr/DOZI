import { Check, Circle, CircleCheck, Layers, type LucideIcon } from 'lucide-react-native';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Button, Confetti, ProgressBar, Text } from '@/components/ui';
import { Dozi } from '@/features/mascot';
import { strings } from '@/i18n/strings';
import { courseSwatch, doodleLayer, useTheme } from '@/theme';

import type { KeyPointProgress } from '../keyPoints';
import { FullScreen } from './FullScreen';

const t = strings.notes.keyPoints;

/**
 * The "key points in your cards" card under the note title (mockup F2): Pierre at his desk, the
 * count and a bar. Tap for the list. Hidden until the note has a key point.
 */
export function KeyPointsMeter({
  progress,
  onPress,
}: {
  progress: Pick<KeyPointProgress, 'covered' | 'total'>;
  onPress: () => void;
}) {
  const { colors, scheme } = useTheme();
  if (progress.total === 0) return null;
  const done = progress.covered === progress.total;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.meter(progress.covered, progress.total)}
      accessibilityHint={t.meterHint}
      onPress={onPress}
      className="mb-1 mt-1 flex-row items-center gap-2.5 rounded-2xl border-2 border-outline bg-surface px-3 py-2 active:opacity-80"
      style={doodleLayer(colors, done ? 'green' : 'teal', 8, scheme)}
    >
      <Dozi mood={done ? 'proud' : 'studying'} size={40} animated={false} />
      <View className="flex-1 gap-1">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text variant="small" className="flex-1 font-body-semibold" numberOfLines={1}>
            {t.meterTitle}
          </Text>
          <Text variant="bodyStrong" tone="primary">
            {t.meterCount(progress.covered, progress.total)}
          </Text>
        </View>
        <ProgressBar
          value={progress.covered / progress.total}
          tone={done ? 'success' : 'primary'}
        />
      </View>
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

/**
 * "What this note earned" (mockup A2), full screen over the note: shown once, when the last key
 * point goes into a card. No XP numbers yet: they aren't decided.
 */
export function NoteEarned({
  visible,
  noteTitle,
  cards,
  points,
  deckId,
  onOpenDeck,
  onClose,
}: {
  visible: boolean;
  noteTitle: string;
  cards: number;
  points: number;
  /** The deck the cards are in, when they are all in one. */
  deckId: string | null;
  onOpenDeck: (deckId: string) => void;
  onClose: () => void;
}) {
  const { colors, scheme } = useTheme();
  const teal = courseSwatch(scheme, 'teal');
  return (
    <FullScreen visible={visible} onClose={onClose} background={teal.fill}>
      <ScrollView contentContainerClassName="flex-grow items-center gap-4 px-5 pb-4 pt-2">
        <Confetti height={320} />
        <View
          className="items-center justify-center rounded-full border-[3px] border-outline bg-surface"
          style={{ width: 140, height: 140 }}
        >
          <Dozi mood="celebrating" size={120} />
        </View>
        <View className="items-center gap-1">
          <Text
            variant="heading"
            className="text-center"
            accessibilityRole="header"
            style={{ color: teal.ink }}
          >
            {t.earnedHeading}
          </Text>
          <Text
            variant="small"
            className="text-center"
            style={{ color: teal.ink }}
            numberOfLines={2}
          >
            {noteTitle}
          </Text>
        </View>
        <View
          className="w-full gap-3 rounded-2xl border-2 border-outline bg-surface p-4"
          style={doodleLayer(colors, 'amber', 10, scheme)}
        >
          <EarnedRow icon={Layers} colour="amber" label={t.earnedCardsLabel} value={`${cards}`} />
          <EarnedRow
            icon={Check}
            colour="green"
            label={t.earnedPointsLabel}
            value={t.meterCount(points, points)}
          />
        </View>
        <Text variant="body" className="text-center" style={{ color: teal.ink }}>
          {t.earnedMessage}
        </Text>
        <View className="flex-1" />
        <View className="w-full gap-2">
          {deckId ? (
            <Button label={t.earnedOpenDeck} onPress={() => onOpenDeck(deckId)} fullWidth />
          ) : null}
          <Button
            label={t.earnedBack}
            variant={deckId ? 'ghost' : 'primary'}
            onPress={onClose}
            fullWidth
          />
        </View>
      </ScrollView>
    </FullScreen>
  );
}

function EarnedRow({
  icon: Icon,
  colour,
  label,
  value,
}: {
  icon: LucideIcon;
  colour: 'amber' | 'green';
  label: string;
  value: string;
}) {
  const { scheme } = useTheme();
  const swatch = courseSwatch(scheme, colour);
  return (
    <View
      className="flex-row items-center gap-3"
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-xl border-[1.5px] border-outline"
        style={{ backgroundColor: swatch.fill }}
      >
        <Icon size={18} color={swatch.ink} />
      </View>
      <Text variant="body" className="flex-1">
        {label}
      </Text>
      <Text variant="subheading">{value}</Text>
    </View>
  );
}
