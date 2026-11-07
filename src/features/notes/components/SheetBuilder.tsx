import { ArrowLeft, ChevronDown, ChevronUp, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, TextInput, useWindowDimensions, View } from 'react-native';

import { Button, Chip, IconButton, Input, Text, useToast } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme';

import {
  CUSTOM_BOX_TITLE_MAX,
  CUSTOM_SHEET_BOXES_MAX,
  CUSTOM_SHEET_NAME_MAX,
  customBoxKinds,
  moveItem,
  newBox,
  sheetProblem,
  type CustomBox,
  type CustomSheet,
} from '../customSheets';
import { useCustomSheets } from '../hooks';

const t = strings.notes.customSheet;
const log = createLogger('notes');

/**
 * "Build your own sheet" (task 1.14b): a name and the boxes the student wants, top to bottom.
 * Saving keeps the sheet for next time and starts a note from it.
 */
export function SheetBuilder({
  onBack,
  onSaved,
}: {
  onBack: () => void;
  onSaved: (sheet: CustomSheet) => void;
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const toast = useToast();
  const { sheets, save } = useCustomSheets();
  const [name, setName] = useState('');
  const [boxes, setBoxes] = useState<CustomBox[]>(() => [newBox('notes')]);
  const [saving, setSaving] = useState(false);
  const problem = sheetProblem(name, boxes, sheets);

  const setTitle = (index: number, title: string) =>
    setBoxes((current) => current.map((box, i) => (i === index ? { ...box, title } : box)));

  const submit = async () => {
    if (problem || saving) return;
    setSaving(true);
    try {
      const sheet = await save(name, boxes);
      toast.show({ message: t.saved(sheet.name), tone: 'success' });
      onSaved(sheet);
    } catch (error) {
      log.warn('Could not save a sheet', { error: String(error) });
      toast.show({ message: strings.library.failed, tone: 'error' });
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ maxHeight: height * 0.68 }}
      contentContainerClassName="gap-3 pb-2"
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-row items-center gap-2">
        <IconButton icon={ArrowLeft} accessibilityLabel={t.back} onPress={onBack} />
        <Text variant="bodyStrong" className="flex-1">
          {t.title}
        </Text>
      </View>

      <Input
        label={t.nameLabel}
        placeholder={t.namePlaceholder}
        value={name}
        onChangeText={setName}
        maxLength={CUSTOM_SHEET_NAME_MAX}
      />

      <Text variant="caption" tone="muted" className="uppercase">
        {t.boxesHeading}
      </Text>
      {boxes.length === 0 ? (
        <Text variant="small" tone="muted">
          {t.noBoxes}
        </Text>
      ) : null}
      {boxes.map((box, index) => {
        const label = box.title.trim() || t.boxKinds[box.kind];
        return (
          <View
            key={index}
            className="flex-row items-center gap-1 rounded-xl border-2 border-outline bg-surface py-1 pl-3"
          >
            <View className="flex-1">
              <Text variant="caption" tone="muted">
                {`${index + 1}. ${t.boxKinds[box.kind]}`}
              </Text>
              <TextInput
                value={box.title}
                onChangeText={(value) => setTitle(index, value)}
                accessibilityLabel={t.boxTitleLabel(index + 1)}
                maxLength={CUSTOM_BOX_TITLE_MAX}
                placeholder={t.boxKinds[box.kind]}
                placeholderTextColor={colors['fg-muted']}
                className="min-h-touch font-body-semibold text-body text-fg"
              />
            </View>
            <IconButton
              icon={ChevronUp}
              size={20}
              accessibilityLabel={t.moveUp(label)}
              disabled={index === 0}
              onPress={() => setBoxes((current) => moveItem(current, index, -1))}
            />
            <IconButton
              icon={ChevronDown}
              size={20}
              accessibilityLabel={t.moveDown(label)}
              disabled={index === boxes.length - 1}
              onPress={() => setBoxes((current) => moveItem(current, index, 1))}
            />
            <IconButton
              icon={X}
              size={20}
              accessibilityLabel={t.remove(label)}
              onPress={() => setBoxes((current) => current.filter((_, i) => i !== index))}
            />
          </View>
        );
      })}

      {boxes.length < CUSTOM_SHEET_BOXES_MAX ? (
        <>
          <Text variant="caption" tone="muted" className="uppercase">
            {t.addHeading}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {customBoxKinds.map((kind) => (
              <Chip
                key={kind}
                label={t.boxKinds[kind]}
                onPress={() => setBoxes((current) => [...current, newBox(kind)])}
              />
            ))}
          </View>
        </>
      ) : null}

      {problem ? (
        <Text variant="small" tone="muted" accessibilityLiveRegion="polite">
          {problem}
        </Text>
      ) : null}
      <Button label={t.save} disabled={!!problem} loading={saving} onPress={() => void submit()} />
    </ScrollView>
  );
}
