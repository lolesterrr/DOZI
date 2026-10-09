import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Brain,
  FileX,
  FolderInput,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Play,
  Plus,
  Settings2,
  Tags,
  Trash2,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet, Button, EmptyState, IconButton, Text, useToast } from '@/components/ui';
import type { Card, Deck } from '@/db/schema';
import { FolderPicker } from '@/features/library/components/FolderPicker';
import { NameForm } from '@/features/library/components/NameForm';
import { SheetAction } from '@/features/library/components/SheetAction';
import { TagPicker } from '@/features/library/components/TagPicker';
import { useFolders, useItemTagMap, useLibraryActions, useTags } from '@/features/library/hooks';
import { Dozi } from '@/features/mascot';
import { useDueCount } from '@/features/review/hooks';
import { openReview } from '@/features/review/navigation';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

import { useDeck, useDeckActions, useDeckCards } from '../hooks';
import { docToField } from '../logic';
import { deckTitleMessage } from '../messages';
import { openCardEditor } from '../navigation';
import { DeckSettingsForm } from './DeckSettingsForm';

const s = strings.decks;
const log = createLogger('decks');

function backToLibrary() {
  if (router.canGoBack()) router.back();
  else router.replace('/library');
}

/** The deck screen: loads the deck, then shows its cards (or why it can't). */
export function DeckScreen({ id }: { id: string }) {
  const { deck, loading } = useDeck(id);
  const insets = useSafeAreaInsets();
  if (loading) return <View className="flex-1 bg-background" />;
  if (!deck || deck.deletedAt) {
    return (
      <View className="flex-1 justify-center bg-background" style={{ paddingTop: insets.top }}>
        <EmptyState
          icon={FileX}
          title={s.missingTitle}
          message={s.missingMessage}
          actionLabel={s.back}
          onAction={backToLibrary}
        />
      </View>
    );
  }
  return <DeckDetail deck={deck} />;
}

type Sheet = 'actions' | 'rename' | 'settings' | 'move' | 'tags';

function DeckDetail({ deck }: { deck: Deck }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const actions = useDeckActions();
  const library = useLibraryActions();
  const cards = useDeckCards(deck.id);
  // Re-counted when the deck changes (cards added or edited, settings saved) and on coming back.
  const due = useDueCount({ deckId: deck.id }, deck.updatedAt);
  const folders = useFolders('deck');
  const tags = useTags();
  const tagMap = useItemTagMap('deck');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const close = () => setSheet(null);

  const run = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      log.warn('Deck change failed', { error: String(error) });
      toast.show({ message: strings.library.failed, tone: 'error' });
    }
  };

  const deleteDeck = () =>
    run(async () => {
      close();
      const deletedAt = await actions.deleteDeck(deck.id);
      backToLibrary();
      toast.show({
        message: s.deleted(deck.title),
        actionLabel: strings.library.undo,
        onAction: () => void run(() => actions.restoreDeck(deck.id, deletedAt)),
      });
    });

  const sheetTitle =
    sheet === 'rename'
      ? s.renameTitle
      : sheet === 'settings'
        ? s.settings.title
        : sheet === 'move'
          ? strings.library.moveTitle(deck.title)
          : sheet === 'tags'
            ? strings.library.itemTagsTitle(deck.title)
            : deck.title;

  const header = (
    <View className="gap-3 px-4 pb-3 pt-1">
      <Text variant="small" tone="muted" accessibilityLiveRegion="polite">
        {s.summary(cards.length, due)}
      </Text>
      {deck.description ? <Text variant="body">{deck.description}</Text> : null}
      <View className="flex-row flex-wrap gap-2">
        {cards.length > 0 ? (
          <Button
            label={due ? s.studyCount(due) : s.study}
            icon={Play}
            disabled={!due}
            onPress={() => openReview(deck.id)}
          />
        ) : null}
        <Button
          label={s.addCards}
          icon={Plus}
          variant={cards.length > 0 ? 'secondary' : 'primary'}
          onPress={() => openCardEditor(deck.id, 'new')}
        />
        <Button
          label={s.actions.settings}
          icon={Settings2}
          variant="outline"
          onPress={() => setSheet('settings')}
        />
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-1">
        <IconButton icon={ArrowLeft} accessibilityLabel={s.back} onPress={backToLibrary} />
        <Text variant="title" numberOfLines={2} className="flex-1">
          {deck.title}
        </Text>
        <IconButton
          icon={MoreVertical}
          accessibilityLabel={s.moreOptions}
          onPress={() => setSheet('actions')}
        />
      </View>

      <FlashList
        data={cards}
        keyExtractor={(card) => card.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            illustration={<Dozi mood="encouraging" />}
            title={s.empty.title}
            message={s.empty.message}
            actionLabel={s.addCards}
            onAction={() => openCardEditor(deck.id, 'new')}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        renderItem={({ item }) => (
          <CardRow card={item} onPress={() => openCardEditor(deck.id, item.id)} />
        )}
      />

      <BottomSheet visible={sheet !== null} onClose={close} title={sheetTitle}>
        {sheet === 'actions' ? (
          <View className="pb-2">
            <SheetAction
              icon={deck.pinned ? PinOff : Pin}
              label={deck.pinned ? s.actions.unpin : s.actions.pin}
              onPress={() =>
                void run(async () => {
                  close();
                  await actions.setPinned(deck.id, !deck.pinned);
                })
              }
            />
            <SheetAction
              icon={Brain}
              label={s.cram}
              disabled={cards.length === 0}
              onPress={() => {
                close();
                openReview(deck.id, 'cram');
              }}
            />
            <SheetAction
              icon={Pencil}
              label={s.actions.rename}
              onPress={() => setSheet('rename')}
            />
            <SheetAction
              icon={Settings2}
              label={s.actions.settings}
              onPress={() => setSheet('settings')}
            />
            <SheetAction
              icon={FolderInput}
              label={s.actions.move}
              onPress={() => setSheet('move')}
            />
            <SheetAction icon={Tags} label={s.actions.tags} onPress={() => setSheet('tags')} />
            <SheetAction
              icon={Trash2}
              label={s.actions.delete}
              danger
              onPress={() => void deleteDeck()}
            />
          </View>
        ) : null}

        {sheet === 'rename' ? (
          <NameForm
            initialName={deck.title}
            placeholder={s.titlePlaceholder}
            submitLabel={strings.library.save}
            validate={deckTitleMessage}
            onCancel={close}
            onSubmit={(title) =>
              run(async () => {
                await actions.renameDeck(deck.id, title);
                close();
              })
            }
          />
        ) : null}

        {sheet === 'settings' ? (
          <DeckSettingsForm
            deck={deck}
            onCancel={close}
            onSave={(settings) =>
              run(async () => {
                await actions.updateSettings(deck.id, settings);
                close();
                toast.show({ message: s.settings.saved, tone: 'success' });
              })
            }
          />
        ) : null}

        {sheet === 'move' ? (
          <FolderPicker
            folders={folders}
            currentParentId={deck.folderId ?? null}
            onPick={(folderId) =>
              void run(async () => {
                await actions.moveDeck(deck.id, folderId);
                close();
                toast.show({ message: strings.library.moved(deck.title), tone: 'success' });
              })
            }
          />
        ) : null}

        {sheet === 'tags' ? (
          <View className="gap-3">
            <TagPicker
              tags={tags}
              selected={tagMap.get(deck.id) ?? []}
              onChange={(tagIds) => void run(() => library.setItemTags('deck', deck.id, tagIds))}
              onCreate={(name) => library.createTag(name, 'teal')}
            />
            <Button label={strings.library.done} onPress={close} />
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

/** One card in the deck list: its type, the start of the front and of the back. */
function CardRow({ card, onPress }: { card: Card; onPress: () => void }) {
  const front = firstLine(card.frontText) || imageOnly(card.frontJson);
  const back = firstLine(card.backText);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={s.cardActions(front)}
      onPress={onPress}
      className="mx-4 mb-2 min-h-touch gap-1 rounded-lg border border-border bg-surface px-4 py-3 active:opacity-80"
    >
      <Text variant="caption" tone="muted">
        {strings.cards.types[card.type]}
        {card.suspended ? ` · ${s.suspendedLabel}` : ''}
      </Text>
      <Text variant="bodyStrong" numberOfLines={2}>
        {front}
      </Text>
      {back ? (
        <Text variant="small" tone="muted" numberOfLines={1}>
          {back}
        </Text>
      ) : null}
    </Pressable>
  );
}

function firstLine(text: string): string {
  return (
    text
      .split('\n')
      .find((line) => line.trim() !== '')
      ?.trim() ?? ''
  );
}

function imageOnly(frontJson: string): string {
  return docToField(frontJson).mediaIds.length > 0 ? strings.media.imageLabel : '';
}
