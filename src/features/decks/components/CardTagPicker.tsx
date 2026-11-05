import { Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Chip, Input, Text } from '@/components/ui';
import { cleanName, TAG_NAME_MAX } from '@/features/library/logic';
import { strings } from '@/i18n/strings';

import { cardTagProblem, sameCardTag, type TagUse } from '../logic';

const s = strings.cards.tags;

export type CardTagOption = { name: string; use: TagUse };

/**
 * Picks card tags (they stay inside the deck): every tag the deck uses as a chip, ticked when the
 * card has it, plus a box to type a new one. For several cards at once a tag can be on only some
 * of them; it then shows a dash and tapping it puts it on all.
 */
export function CardTagPicker({
  options,
  onToggle,
  onAdd,
  full = false,
  maxTags,
}: {
  options: readonly CardTagOption[];
  /** Tapped a chip: `use` is the tag's state before the tap. */
  onToggle: (name: string, use: TagUse) => void;
  /** Typed a new name and pressed its chip (or the keyboard's done key). */
  onAdd: (name: string) => void;
  /** No room for more tags (shows why instead of the add chip). */
  full?: boolean;
  maxTags?: number;
}) {
  const [query, setQuery] = useState('');
  const cleaned = cleanName(query);
  const problem = cleaned ? cardTagProblem(cleaned) : null;
  const match = cleaned ? options.find((o) => sameCardTag(o.name, cleaned)) : undefined;
  const shown = cleaned
    ? options.filter((o) => o.name.toLocaleLowerCase().includes(cleaned.toLocaleLowerCase()))
    : options;
  const canAdd = cleaned !== '' && problem === null && !match && !full;

  const add = () => {
    if (match) {
      if (match.use !== 'all') onToggle(match.name, match.use);
      setQuery('');
      return;
    }
    if (!canAdd) return;
    onAdd(cleaned);
    setQuery('');
  };

  return (
    <View className="gap-3">
      <Input
        label={s.inputLabel}
        value={query}
        onChangeText={setQuery}
        placeholder={s.placeholder}
        maxLength={TAG_NAME_MAX + 10}
        returnKeyType="done"
        blurOnSubmit={false}
        onSubmitEditing={add}
        error={problem === 'tooLong' ? s.tooLong(TAG_NAME_MAX) : undefined}
      />
      {shown.length > 0 || canAdd ? (
        <View className="flex-row flex-wrap gap-2">
          {shown.map((option) => (
            <Chip
              key={option.name}
              label={option.use === 'some' ? s.onSomeLabel(option.name) : option.name}
              selected={option.use === 'all'}
              icon={option.use === 'some' ? Minus : undefined}
              disabled={full && option.use === 'none'}
              onPress={() => onToggle(option.name, option.use)}
            />
          ))}
          {canAdd ? <Chip label={s.add(cleaned)} icon={Plus} onPress={add} /> : null}
        </View>
      ) : null}
      {full && maxTags ? (
        <Text variant="small" tone="muted">
          {s.full(maxTags)}
        </Text>
      ) : null}
    </View>
  );
}
