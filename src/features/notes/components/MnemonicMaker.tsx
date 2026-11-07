import { Check, Plus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Chip, IconButton, Text } from '@/components/ui';
import { Dozi } from '@/features/mascot';
import { strings } from '@/i18n/strings';
import { courseSwatch, doodleLayer, useTheme } from '@/theme';

import {
  checkPhrase,
  MNEMONIC_ITEM_MAX,
  MNEMONIC_ITEMS_MAX,
  MNEMONIC_ITEMS_MIN,
  mnemonicItems,
} from '../mnemonic';
import { DeckSheet, noteDeckTitle } from './DeckSheet';
import { FullScreen } from './FullScreen';

const t = strings.notes.mnemonic;

export type MadeMnemonic = { name: string; items: string[]; phrase: string };

/**
 * The mnemonic maker (task 1.14c, mockup F3), full screen over the note: (1) the things to
 * remember as chips, (2) their first letters as big tiles that tick as the phrase is typed,
 * (3) the 2 cards it makes, then the deck to put them in. Each tile says in words whether its
 * word matches, so colour is never the only sign.
 */
export function MnemonicMaker({
  visible,
  noteTitle,
  lists,
  lastDeckId,
  onClose,
  onSave,
}: {
  visible: boolean;
  noteTitle: string;
  /** Lists found in the note, offered as a quick start. */
  lists: string[][];
  lastDeckId: string | null;
  onClose: () => void;
  onSave: (made: MadeMnemonic, deckId: string | null) => void;
}) {
  return (
    <FullScreen visible={visible} title={t.title} subtitle={noteTitle} onClose={onClose}>
      {visible ? (
        <Maker noteTitle={noteTitle} lists={lists} lastDeckId={lastDeckId} onSave={onSave} />
      ) : null}
    </FullScreen>
  );
}

function Maker({
  noteTitle,
  lists,
  lastDeckId,
  onSave,
}: {
  noteTitle: string;
  lists: string[][];
  lastDeckId: string | null;
  onSave: (made: MadeMnemonic, deckId: string | null) => void;
}) {
  const { colors, scheme } = useTheme();
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [phrase, setPhrase] = useState('');
  const [pickingDeck, setPickingDeck] = useState(false);
  const check = useMemo(() => checkPhrase(items, phrase), [items, phrase]);
  const name = noteTitle;
  const paper = courseSwatch(scheme, 'amber');
  const tileOk = courseSwatch(scheme, 'teal');

  const add = (value: string) => {
    const added = mnemonicItems(value);
    if (added.length === 0) return;
    setItems((current) => [...current, ...added].slice(0, MNEMONIC_ITEMS_MAX));
    setDraft('');
  };

  const enough = items.length >= MNEMONIC_ITEMS_MIN;
  const ready = enough && check.complete;
  const nextIndex = check.letters.findIndex((match) => !match.ok);

  if (pickingDeck) {
    return (
      <View className="flex-1 gap-3 px-4 pt-2">
        <Text variant="subheading">{t.pickDeck}</Text>
        <DeckSheet
          hint={t.deckHint}
          newDeckTitle={noteDeckTitle(noteTitle)}
          lastDeckId={lastDeckId}
          onPick={(deckId) => onSave({ name, items, phrase }, deckId)}
        />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: paper.fill }}>
      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-6 pt-3"
        keyboardShouldPersistTaps="handled"
      >
        <Step n={1} title={t.step1} />
        {items.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {items.map((item, i) => (
              <Pressable
                key={`${item}-${i}`}
                accessibilityRole="button"
                accessibilityLabel={t.removeItem(item)}
                onPress={() => setItems((current) => current.filter((_, j) => j !== i))}
                className="min-h-touch flex-row items-center gap-1 rounded-full border-2 border-outline bg-surface px-3 active:opacity-70"
              >
                <Text variant="small" className="font-body-semibold">
                  {item}
                </Text>
                <X size={14} color={colors['fg-muted']} />
              </Pressable>
            ))}
          </View>
        ) : null}
        {items.length > 0 ? (
          <Text variant="caption" tone="muted">
            {t.itemsInOrder}
          </Text>
        ) : null}
        {items.length < MNEMONIC_ITEMS_MAX ? (
          <View className="flex-row items-center gap-2">
            <TextInput
              value={draft}
              onChangeText={(value) => (value.includes('\n') ? add(value) : setDraft(value))}
              onSubmitEditing={() => add(draft)}
              submitBehavior="submit"
              returnKeyType="done"
              accessibilityLabel={t.addItemLabel}
              placeholder={t.addItemPlaceholder}
              placeholderTextColor={colors['fg-muted']}
              maxLength={MNEMONIC_ITEM_MAX}
              className="min-h-touch flex-1 rounded-2xl border-2 border-dashed border-outline bg-surface px-3.5 font-body text-body text-fg"
            />
            <IconButton
              icon={Plus}
              variant="soft"
              accessibilityLabel={t.addItem}
              disabled={!draft.trim()}
              onPress={() => add(draft)}
            />
          </View>
        ) : (
          <Text variant="small" tone="muted">
            {t.tooMany(MNEMONIC_ITEMS_MAX)}
          </Text>
        )}
        {lists.length > 0 && items.length === 0 ? (
          <View className="gap-2">
            <Text variant="small" tone="muted">
              {t.fromNote}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {lists.slice(0, 3).map((list, i) => (
                <Chip
                  key={i}
                  label={t.useList(list[0], list.length)}
                  onPress={() => setItems(list.slice(0, MNEMONIC_ITEMS_MAX))}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Step n={2} title={t.step2} />
        {enough ? (
          <>
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
                  className="w-[44px] items-center gap-1"
                >
                  <View
                    className={
                      i === nextIndex
                        ? 'h-[48px] w-[44px] items-center justify-center rounded-[10px] border-2 border-dashed border-outline bg-surface'
                        : 'h-[48px] w-[44px] items-center justify-center rounded-[10px] border-2 border-outline'
                    }
                    style={[
                      i === nextIndex
                        ? null
                        : { backgroundColor: match.ok ? tileOk.fill : colors.surface },
                      i === nextIndex ? null : doodleLayer(colors, 'ink', 6, scheme),
                    ]}
                  >
                    <Text variant="heading" style={match.ok ? { color: tileOk.ink } : undefined}>
                      {match.letter || '?'}
                    </Text>
                    {match.ok ? (
                      <View className="absolute -right-1.5 -top-1.5 h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-outline bg-success">
                        <Check size={11} color={colors['on-success']} strokeWidth={3.5} />
                      </View>
                    ) : null}
                  </View>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {match.word ?? '…'}
                  </Text>
                </View>
              ))}
            </View>
            <TextInput
              value={phrase}
              onChangeText={setPhrase}
              accessibilityLabel={t.phraseLabel}
              placeholder={t.phrasePlaceholder}
              placeholderTextColor={colors['fg-muted']}
              maxLength={300}
              multiline
              className="min-h-[56px] rounded-2xl border-2 border-outline bg-surface px-3.5 py-3 font-heading text-subheading text-fg"
            />
            {check.extra > 0 ? (
              <Text variant="small" tone="muted" accessibilityLiveRegion="polite">
                {t.extraWords(check.extra)}
              </Text>
            ) : null}
            <View className="flex-row items-end gap-2">
              <Dozi mood="thinking" size={48} />
              <View className="flex-1 rounded-2xl rounded-bl-[4px] border-2 border-outline bg-surface px-3 py-2">
                <Text variant="small">{t.phraseHint}</Text>
              </View>
            </View>
          </>
        ) : (
          <Text variant="small" tone="muted">
            {t.needItems(MNEMONIC_ITEMS_MIN)}
          </Text>
        )}

        <Step n={3} title={t.step3} />
        <View className="gap-1 rounded-2xl border-2 border-outline bg-surface px-3 py-2.5">
          <Text variant="caption" tone="muted" className="uppercase">
            {t.makesCards}
          </Text>
          <Text variant="small">{t.cardAsksPhrase(name)}</Text>
          <Text variant="small">
            {t.cardAsksMeaning(phrase.trim() || check.letters.map((l) => l.letter).join(' '))}
          </Text>
        </View>
      </ScrollView>
      <View className="border-t-2 border-outline bg-surface px-4 pb-3 pt-3">
        <Button label={t.save} disabled={!ready} onPress={() => setPickingDeck(true)} fullWidth />
      </View>
    </View>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <View className="flex-row items-center gap-2.5" accessibilityRole="header">
      <View className="h-7 w-7 items-center justify-center rounded-full border-2 border-outline bg-accent">
        <Text variant="small" className="font-body-semibold text-on-accent">
          {n}
        </Text>
      </View>
      <Text variant="bodyStrong" className="flex-1">
        {title}
      </Text>
    </View>
  );
}
