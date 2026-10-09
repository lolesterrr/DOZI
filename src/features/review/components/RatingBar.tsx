import { Pressable, View } from 'react-native';

import { cn, Text } from '@/components/ui';
import {
  RATINGS,
  type IntervalPreview,
  type RatingName,
  type ReviewRating,
} from '@/features/srs/logic';
import { strings } from '@/i18n/strings';

const s = strings.review;

// Each button carries its word, so the tint is only a helper (never colour alone).
const tints: Record<RatingName, { box: string; text: string }> = {
  again: { box: 'bg-danger-soft', text: 'text-on-danger-soft' },
  hard: { box: 'bg-warning-soft', text: 'text-on-warning-soft' },
  good: { box: 'bg-primary-soft', text: 'text-on-primary-soft' },
  easy: { box: 'bg-success-soft', text: 'text-on-success-soft' },
};

export type RatingBarProps = {
  /** Review mode: the next interval for each button. null in cram mode (two buttons). */
  intervals: Record<RatingName, IntervalPreview> | null;
  disabled?: boolean;
  onRate: (rating: ReviewRating) => void;
};

/** Again · Hard · Good · Easy with the next interval on each, or Again · Got it when cramming. */
export function RatingBar({ intervals, disabled, onRate }: RatingBarProps) {
  const buttons: { name: RatingName; label: string; detail: string; a11y: string }[] = intervals
    ? (['again', 'hard', 'good', 'easy'] as const).map((name) => ({
        name,
        label: s.ratings[name],
        detail: intervals[name].label,
        a11y: s.ratingLabel(s.ratings[name], intervals[name].label),
      }))
    : [
        { name: 'again', label: s.ratings.again, detail: s.cramAgainHint, a11y: s.ratings.again },
        { name: 'good', label: s.cramGotIt, detail: '', a11y: s.cramGotIt },
      ];
  return (
    <View className="gap-2">
      <Text variant="small" tone="muted" className="text-center">
        {s.ratingPrompt}
      </Text>
      <View className="flex-row gap-2">
        {buttons.map((button) => (
          <Pressable
            key={button.name}
            accessibilityRole="button"
            accessibilityLabel={button.a11y}
            accessibilityState={{ disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onRate(RATINGS[button.name])}
            className={cn(
              'min-h-[56px] flex-1 items-center justify-center rounded-lg px-1 py-2 active:opacity-80',
              tints[button.name].box,
              disabled && 'opacity-50',
            )}
          >
            <Text
              variant="bodyStrong"
              tone="inherit"
              className={tints[button.name].text}
              numberOfLines={1}
            >
              {button.label}
            </Text>
            {button.detail ? (
              <Text
                variant="caption"
                tone="inherit"
                className={cn('text-center', tints[button.name].text)}
                numberOfLines={2}
              >
                {button.detail}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
