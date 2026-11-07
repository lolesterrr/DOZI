import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { Button, Chip, Input, Text, TextArea } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { checkPhrase, MNEMONIC_ITEMS_MAX, MNEMONIC_ITEMS_MIN, mnemonicItems } from '../mnemonic';

const t = strings.notes.mnemonic;

export type MadeMnemonic = { name: string; items: string[]; phrase: string };

/**
 * The mnemonic maker (task 1.14c): the things to remember, their first letters as tiles, and a
 * phrase checked word by word as the student types. Each tile says in words whether it matches.
 */
export function MnemonicMaker({
  defaultName,
  lists,
  onDone,
}: {
  defaultName: string;
  /** Lists found in the note, offered as a quick start. */
  lists: string[][];
  onDone: (made: MadeMnemonic) => void;
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [name, setName] = useState(defaultName);
  const [itemsText, setItemsText] = useState('');
  const [phrase, setPhrase] = useState('');
  const items = useMemo(() => mnemonicItems(itemsText), [itemsText]);
  const check = useMemo(() => checkPhrase(items, phrase), [items, phrase]);

  const itemsProblem =
    items.length < MNEMONIC_ITEMS_MIN
      ? t.needItems(MNEMONIC_ITEMS_MIN)
      : items.length > MNEMONIC_ITEMS_MAX
        ? t.tooMany(MNEMONIC_ITEMS_MAX)
        : null;
  const ready = !itemsProblem && check.complete;

  return (
    <ScrollView
      style={{ maxHeight: height * 0.68 }}
      contentContainerClassName="gap-3 pb-2"
      keyboardShouldPersistTaps="handled"
    >
      <Input
        label={t.forLabel}
        placeholder={t.forPlaceholder}
        value={name}
        onChangeText={setName}
        maxLength={80}
      />

      {lists.length > 0 ? (
        <View className="gap-2">
          <Text variant="small" tone="muted">
            {t.fromNote}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {lists.slice(0, 3).map((list, i) => (
              <Chip
                key={i}
                label={t.useList(list[0], list.length)}
                onPress={() => setItemsText(list.join('\n'))}
              />
            ))}
          </View>
        </View>
      ) : null}

      <TextArea
        label={t.itemsLabel}
        placeholder={t.itemsPlaceholder}
        value={itemsText}
        onChangeText={setItemsText}
        minLines={3}
        hint={itemsProblem ?? undefined}
      />

      {items.length > 0 && !itemsProblem ? (
        <>
          <Text variant="caption" tone="muted" className="uppercase">
            {t.lettersHeading}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {check.letters.map((match, i) => (
              <View
                key={i}
                accessible
                accessibilityLabel={
                  match.word === null
                    ? t.letterMissing(match.letter)
                    : match.ok
                      ? t.letterOk(match.letter, match.word)
                      : t.letterWrong(match.letter, match.word)
                }
                className={
                  match.ok
                    ? 'min-w-[56px] items-center rounded-lg border-2 border-outline bg-success-soft px-2 py-1'
                    : 'min-w-[56px] items-center rounded-lg border-2 border-outline bg-surface px-2 py-1'
                }
              >
                <View className="flex-row items-center gap-1">
                  <Text variant="subheading">{match.letter || '?'}</Text>
                  {match.ok ? <Check size={14} color={colors['on-success-soft']} /> : null}
                </View>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {match.word ?? '…'}
                </Text>
              </View>
            ))}
          </View>
          <Input
            label={t.phraseLabel}
            placeholder={t.phrasePlaceholder}
            value={phrase}
            onChangeText={setPhrase}
            maxLength={300}
            hint={check.extra > 0 ? t.extraWords(check.extra) : t.phraseHint}
          />
        </>
      ) : null}

      <Button
        label={t.save}
        disabled={!ready}
        onPress={() => onDone({ name: name.trim() || defaultName, items, phrase })}
      />
    </ScrollView>
  );
}
