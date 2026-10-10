import { Check, ChevronRight, Search } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { Chip, cn, Input, Text } from '@/components/ui';
import type { Question, QuestionType } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { questionPreview, questionTypes } from '../logic';

const s = strings.questions;

/** The bank's search box and type filter chips. */
export function QuestionFilters({
  query,
  onQueryChange,
  type,
  onTypeChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  type: QuestionType | null;
  onTypeChange: (type: QuestionType | null) => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Search color={colors['fg-muted']} size={20} />
        <View className="flex-1">
          <Input
            label={s.searchLabel}
            placeholder={s.searchPlaceholder}
            value={query}
            onChangeText={onQueryChange}
            autoCorrect={false}
          />
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        <Chip label={s.allTypes} selected={type === null} onPress={() => onTypeChange(null)} />
        {questionTypes.map((t) => (
          <Chip key={t} label={s.types[t]} selected={type === t} onPress={() => onTypeChange(t)} />
        ))}
      </ScrollView>
    </View>
  );
}

/** A question's one-line preview, or "Image" for a question that is only a picture. */
export function previewOf(question: Pick<Question, 'stemText'>): string {
  return questionPreview(question.stemText) || strings.quizzes.row.imageOnly;
}

/**
 * One question in a list. In the bank it opens the editor (chevron); in the "Add from bank"
 * picker it is a checkbox (tick and "Selected", never colour alone).
 */
export function QuestionRow({
  question,
  note,
  selectable = false,
  selected = false,
  disabled = false,
  onPress,
}: {
  question: Question;
  /** e.g. "Used in 2 quizzes" or "Already in this quiz". */
  note?: string;
  selectable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const preview = previewOf(question);
  return (
    <Pressable
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityLabel={selectable ? s.select(preview) : s.open(preview)}
      accessibilityState={selectable ? { checked: selected, disabled } : { disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'mb-2 min-h-touch flex-row items-center gap-3 rounded-lg border bg-surface px-4 py-3 active:opacity-80',
        selected ? 'border-primary' : 'border-border',
        disabled && 'opacity-60',
      )}
    >
      {selectable ? (
        <View
          className={cn(
            'h-6 w-6 items-center justify-center rounded border-2',
            selected ? 'border-primary bg-primary' : 'border-border',
          )}
        >
          {selected ? <Check color={colors['on-primary']} size={16} /> : null}
        </View>
      ) : null}
      <View className="flex-1 gap-1">
        <Text variant="caption" tone="muted">
          {s.types[question.type]}
        </Text>
        <Text variant="bodyStrong" numberOfLines={2}>
          {preview}
        </Text>
        {note ? (
          <Text variant="small" tone="muted">
            {note}
          </Text>
        ) : null}
      </View>
      {selectable ? null : <ChevronRight color={colors['fg-muted']} size={20} />}
    </Pressable>
  );
}
