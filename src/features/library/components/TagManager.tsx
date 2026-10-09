import { Check, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, cn, Text } from '@/components/ui';
import { tagColours, type Tag, type TagColour } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { tagColourTokens, tagNameProblem } from '../logic';
import { NameForm, nameProblemMessage } from './NameForm';
import { TagPill } from './TagPill';

const s = strings.library;

export type TagManagerProps = {
  tags: readonly Tag[];
  onCreate: (name: string, colour: TagColour) => Promise<unknown>;
  onUpdate: (id: string, changes: { name: string; colour: TagColour }) => Promise<unknown>;
  /** The caller closes the sheet and offers Undo. */
  onDelete: (tag: Tag) => void;
  /** Called when the title should change (list ↔ edit). */
  onTitleChange?: (title: string) => void;
};

type Mode = { type: 'list' } | { type: 'new' } | { type: 'edit'; tag: Tag };

/** The Tags sheet: every tag, plus creating, renaming, recolouring and deleting them. */
export function TagManager({ tags, onCreate, onUpdate, onDelete, onTitleChange }: TagManagerProps) {
  const [mode, setModeState] = useState<Mode>({ type: 'list' });
  const [colour, setColour] = useState<TagColour>('teal');

  const setMode = (next: Mode) => {
    setModeState(next);
    if (next.type === 'edit') setColour(next.tag.colour);
    if (next.type === 'new') setColour('teal');
    onTitleChange?.(
      next.type === 'list'
        ? s.manageTagsTitle
        : next.type === 'new'
          ? s.newTagTitle
          : s.editTagTitle,
    );
  };

  if (mode.type !== 'list') {
    const editing = mode.type === 'edit' ? mode.tag : undefined;
    return (
      <View>
        <NameForm
          key={editing?.id ?? 'new'}
          initialName={editing?.name}
          placeholder={s.tagPlaceholder}
          submitLabel={editing ? s.save : s.create}
          validate={(name) => {
            const problem = tagNameProblem(name, tags, editing?.id);
            return problem ? nameProblemMessage(problem, 'tag') : null;
          }}
          onSubmit={async (name) => {
            if (editing) await onUpdate(editing.id, { name, colour });
            else await onCreate(name, colour);
            setMode({ type: 'list' });
          }}
          onCancel={() => setMode({ type: 'list' })}
        >
          <ColourChooser value={colour} onChange={setColour} />
        </NameForm>
        {editing ? (
          <Button
            label={s.deleteTag}
            variant="ghost"
            icon={Trash2}
            className="mb-2 self-start"
            onPress={() => onDelete(editing)}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View className="gap-3 pb-2">
      {tags.length === 0 ? (
        <Text tone="muted">{s.noTags}</Text>
      ) : (
        <ScrollView style={{ maxHeight: 360 }}>
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} onPress={() => setMode({ type: 'edit', tag })} />
          ))}
        </ScrollView>
      )}
      <Button
        label={s.newTag}
        icon={Plus}
        variant="secondary"
        onPress={() => setMode({ type: 'new' })}
      />
    </View>
  );
}

function TagRow({ tag, onPress }: { tag: Tag; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={s.editTag(tag.name)}
      onPress={onPress}
      className="min-h-touch flex-row items-center gap-3 rounded-md px-2 py-2 active:bg-surface-muted"
    >
      <View className="flex-1">
        <TagPill tag={tag} />
      </View>
      <Pencil color={colors['fg-muted']} size={18} />
    </Pressable>
  );
}

/** Colour choices, each shown as a swatch **and** its name. */
export function ColourChooser({
  value,
  onChange,
}: {
  value: TagColour;
  onChange: (colour: TagColour) => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="gap-1.5">
      <Text variant="label">{s.colourLabel}</Text>
      <View className="flex-row flex-wrap gap-2">
        {tagColours.map((colour) => {
          const selected = colour === value;
          const tokens = tagColourTokens[colour];
          return (
            <Pressable
              key={colour}
              accessibilityRole="radio"
              accessibilityLabel={s.colours[colour]}
              accessibilityState={{ selected }}
              onPress={() => onChange(colour)}
              className={cn(
                'min-h-touch flex-row items-center gap-2 rounded-full border px-3',
                selected ? 'border-primary border-2' : 'border-border',
              )}
            >
              <View
                style={{ backgroundColor: colors[tokens.bg], borderColor: colors[tokens.fg] }}
                className="h-5 w-5 items-center justify-center rounded-full border"
              >
                {selected ? <Check color={colors[tokens.fg]} size={14} /> : null}
              </View>
              <Text variant="label">{s.colours[colour]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
