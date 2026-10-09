import { ImagePlus, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  View,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';

import { Button, Input, TextArea, Text } from '@/components/ui';
import { MediaImage } from '@/features/media/components/MediaImage';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { FIELD_IMAGES_MAX, type CardField, type TextSelection } from '../logic';

const s = strings.cards;

export type FieldEditorProps = {
  label: string;
  placeholder?: string;
  hint?: string;
  field: CardField;
  onChange: (field: CardField) => void;
  /** Type-in answers are one line of text, without images. */
  singleLine?: boolean;
  /** Shows "Add image"; the screen asks gallery or camera and adds the result. */
  onAddImage?: () => void;
  onViewImage?: (mediaId: string) => void;
  /** Controlled selection (the cloze buttons need to know and set it). */
  selection?: TextSelection;
  onSelectionChange?: (selection: TextSelection) => void;
  /** Buttons shown under the text (e.g. the cloze helpers). */
  tools?: ReactNode;
  minLines?: number;
};

/** One card field: text, its images (tap to view, × to remove) and an "Add image" button. */
export function FieldEditor({
  label,
  placeholder,
  hint,
  field,
  onChange,
  singleLine = false,
  onAddImage,
  onViewImage,
  selection,
  onSelectionChange,
  tools,
  minLines = 3,
}: FieldEditorProps) {
  const { colors } = useTheme();
  const handleSelection = onSelectionChange
    ? (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) =>
        onSelectionChange(event.nativeEvent.selection)
    : undefined;

  const removeImage = (index: number) =>
    onChange({ ...field, mediaIds: field.mediaIds.filter((_, i) => i !== index) });

  const canAddImage = !!onAddImage && field.mediaIds.length < FIELD_IMAGES_MAX;

  return (
    <View className="gap-2">
      {singleLine ? (
        <Input
          label={label}
          placeholder={placeholder}
          hint={hint}
          value={field.text}
          onChangeText={(text) => onChange({ ...field, text })}
          autoCapitalize="none"
          autoCorrect={false}
        />
      ) : (
        <TextArea
          label={label}
          placeholder={placeholder}
          hint={hint}
          minLines={minLines}
          value={field.text}
          onChangeText={(text) => onChange({ ...field, text })}
          selection={selection}
          onSelectionChange={handleSelection}
        />
      )}
      {tools}
      {field.mediaIds.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {field.mediaIds.map((id, index) => (
            <View
              key={`${id}-${index}`}
              className="h-24 w-24 overflow-hidden rounded-md border border-border"
            >
              <MediaImage
                id={id}
                className="h-full w-full"
                accessibilityLabel={s.viewImage}
                onPress={onViewImage ? () => onViewImage(id) : undefined}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={s.removeImage}
                hitSlop={8}
                onPress={() => removeImage(index)}
                className="absolute right-1 top-1 h-8 w-8 items-center justify-center rounded-full bg-surface"
              >
                <X color={colors.fg} size={18} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {onAddImage ? (
        <View className="flex-row items-center gap-3">
          <Button
            label={s.addImage}
            icon={ImagePlus}
            variant="outline"
            disabled={!canAddImage}
            onPress={onAddImage}
          />
          {field.mediaIds.length > 0 ? (
            <Text variant="small" tone="muted">
              {s.imageCount(field.mediaIds.length, FIELD_IMAGES_MAX)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
