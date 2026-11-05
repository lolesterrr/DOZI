import { CircleAlert, CircleCheck, CircleX, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FlipInEasyY } from 'react-native-reanimated';

import { cn, Input, Text } from '@/components/ui';
import { CardFaceView } from '@/features/decks/components/CardFaceView';
import { TYPE_IN_ANSWER_MAX, type InstanceFaces } from '@/features/decks/logic';
import { strings } from '@/i18n/strings';
import { doodleLayer, useTheme, type ColorName } from '@/theme';

import { type DiffSegment, type TypedAnswerCheck, type TypedVerdict } from '../logic';

const s = strings.review;

export type ReviewCardViewProps = {
  faces: InstanceFaces | null;
  /**
   * True for a cloze or an occlusion card: its answer side is the whole text or diagram again,
   * so the question isn't repeated.
   */
  answerReplacesQuestion: boolean;
  revealed: boolean;
  /** Type-in cards: the box to type in, and the result once checked. */
  typeIn?: {
    value: string;
    onChange: (text: string) => void;
    onSubmit: () => void;
    check: TypedAnswerCheck | null;
  };
  deckTitle?: string;
  onImagePress?: (mediaId: string) => void;
};

/**
 * One card in a review: the question side, then (once revealed) the answer, with a short flip.
 * Reanimated's layout animations follow the phone's "reduce motion" setting.
 */
export function ReviewCardView({
  faces,
  answerReplacesQuestion,
  revealed,
  typeIn,
  deckTitle,
  onImagePress,
}: ReviewCardViewProps) {
  const { colors } = useTheme();
  return (
    <Animated.View
      key={revealed ? 'answer' : 'question'}
      entering={revealed ? FlipInEasyY.duration(260) : undefined}
      className="gap-4 rounded-[24px] border-2 border-outline bg-surface p-5"
      style={doodleLayer(colors, 'primary', 8)}
    >
      {/* A few confetti dots, just for the doodle look. */}
      <View
        pointerEvents="none"
        className="absolute inset-0"
        importantForAccessibility="no-hide-descendants"
      >
        <View className="absolute left-6 top-3 h-2 w-2 rotate-12 rounded-sm bg-accent" />
        <View className="absolute right-8 top-5 h-2 w-2 rounded-full bg-primary" />
        <View className="absolute right-4 top-14 h-1.5 w-1.5 -rotate-12 rounded-sm bg-accent" />
      </View>
      {deckTitle ? (
        <Text variant="caption" tone="muted" className="text-center">
          {s.deckLabel(deckTitle)}
        </Text>
      ) : null}

      {!faces ? (
        <Text tone="muted">{s.unsupported}</Text>
      ) : !revealed ? (
        <>
          <CardFaceView face={faces.front} onImagePress={onImagePress} />
          {typeIn ? (
            <Input
              label={s.typeLabel}
              placeholder={s.typePlaceholder}
              value={typeIn.value}
              onChangeText={typeIn.onChange}
              onSubmitEditing={typeIn.onSubmit}
              returnKeyType="done"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={TYPE_IN_ANSWER_MAX}
            />
          ) : null}
        </>
      ) : (
        <>
          {answerReplacesQuestion ? null : (
            <>
              <CardFaceView face={faces.front} onImagePress={onImagePress} />
              <View className="h-px bg-border" />
            </>
          )}
          {typeIn?.check ? (
            <TypedResult check={typeIn.check} />
          ) : (
            <CardFaceView face={faces.back} onImagePress={onImagePress} />
          )}
          {faces.extra.length > 0 ? (
            <View className="gap-1.5 rounded-md bg-surface-muted p-3">
              <Text variant="label">{s.extra}</Text>
              <CardFaceView face={faces.extra} onImagePress={onImagePress} />
            </View>
          ) : null}
        </>
      )}
    </Animated.View>
  );
}

const verdictStyle: Record<
  TypedVerdict,
  { icon: LucideIcon; colour: ColorName; box: string; text: string }
> = {
  correct: {
    icon: CircleCheck,
    colour: 'on-success-soft',
    box: 'bg-success-soft',
    text: 'text-on-success-soft',
  },
  close: {
    icon: CircleAlert,
    colour: 'on-warning-soft',
    box: 'bg-warning-soft',
    text: 'text-on-warning-soft',
  },
  wrong: {
    icon: CircleX,
    colour: 'on-danger-soft',
    box: 'bg-danger-soft',
    text: 'text-on-danger-soft',
  },
};

/** The verdict (icon + words, never colour alone) and the letter-by-letter comparison. */
function TypedResult({ check }: { check: TypedAnswerCheck }) {
  const { colors } = useTheme();
  const style = verdictStyle[check.verdict];
  const Icon = style.icon;
  const nothingTyped = check.typed.length === 0;
  return (
    <View className="gap-3">
      <View
        className={cn('flex-row items-center gap-2 rounded-md px-3 py-2', style.box)}
        accessibilityLiveRegion="polite"
      >
        <Icon color={colors[style.colour]} size={20} />
        <Text variant="bodyStrong" tone="inherit" className={style.text}>
          {s.verdicts[check.verdict]}
        </Text>
      </View>
      <View className="gap-1">
        <Text variant="label" tone="muted">
          {s.youTyped}
        </Text>
        {nothingTyped ? (
          <Text tone="muted">{s.nothingTyped}</Text>
        ) : (
          <DiffLine segments={check.typed} />
        )}
      </View>
      <View className="gap-1">
        <Text variant="label" tone="muted">
          {s.expected}
        </Text>
        <DiffLine segments={check.expected} />
      </View>
      {check.verdict !== 'correct' ? (
        <Text variant="caption" tone="muted">
          {s.diffHelp}
        </Text>
      ) : null}
    </View>
  );
}

const segmentClasses: Record<DiffSegment['kind'], string> = {
  same: '',
  // Extra letters: crossed out on pink. Missing letters: underlined on green.
  wrong: 'line-through bg-danger-soft text-on-danger-soft',
  missed: 'underline font-body-semibold bg-success-soft text-on-success-soft',
};

function DiffLine({ segments }: { segments: DiffSegment[] }) {
  return (
    <Text variant="subheading">
      {segments.map((segment, i) => (
        <Text key={i} variant="subheading" tone="inherit" className={segmentClasses[segment.kind]}>
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}
