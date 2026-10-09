import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Chip, Input } from '@/components/ui';
import type { Tag } from '@/db/schema';
import { strings } from '@/i18n/strings';

import { cleanName, tagNameProblem, toggleId } from '../logic';

const s = strings.library;

export type TagPickerProps = {
  tags: readonly Tag[];
  selected: readonly string[];
  onChange: (tagIds: string[]) => void;
  /** Creates a tag from what was typed; the new tag is selected straight away. */
  onCreate: (name: string) => Promise<Tag>;
};

/**
 * Choose the tags on one note, deck or quiz: tap to toggle, or type to find or add one.
 * Used by the item screens (notes 1.3, decks 1.6, quizzes 1.10).
 */
export function TagPicker({ tags, selected, onChange, onCreate }: TagPickerProps) {
  const [query, setQuery] = useState('');
  const cleaned = cleanName(query);
  const shown = cleaned
    ? tags.filter((t) => t.name.toLowerCase().includes(cleaned.toLowerCase()))
    : tags;
  const canAdd = cleaned !== '' && tagNameProblem(cleaned, tags) === null;

  return (
    <View className="gap-3 pb-2">
      <Input
        label={s.nameLabel}
        value={query}
        onChangeText={setQuery}
        placeholder={s.tagPlaceholder}
      />
      <ScrollView style={{ maxHeight: 280 }} contentContainerClassName="flex-row flex-wrap gap-2">
        {shown.map((tag) => (
          <Chip
            key={tag.id}
            label={tag.name}
            selected={selected.includes(tag.id)}
            onPress={() => onChange(toggleId(selected, tag.id))}
          />
        ))}
        {canAdd ? (
          <Chip
            label={s.addTag(cleaned)}
            icon={Plus}
            onPress={async () => {
              const tag = await onCreate(cleaned);
              setQuery('');
              onChange([...selected, tag.id]);
            }}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
