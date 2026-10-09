import { router } from 'expo-router';
import { ArrowLeft, Camera, Eye, FileX, Images, Scissors, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet, Button, Chip, EmptyState, IconButton, Text, useToast } from '@/components/ui';
import type { Card, Deck } from '@/db/schema';
import { SheetAction } from '@/features/library/components/SheetAction';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { useAddImage, useDeleteMedia } from '@/features/media/hooks';
import type { ImageSourceKind } from '@/features/media/pipeline';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme';

import { useCard, useDeck, useDeckActions } from '../hooks';
import {
  cardDraftProblem,
  cardToDraft,
  clozeNumbers,
  editableCardTypes,
  emptyDraft,
  FIELD_IMAGES_MAX,
  FIELD_TEXT_MAX,
  lastClozeNumber,
  nextBulkDraft,
  nextClozeNumber,
  TYPE_IN_ANSWER_MAX,
  wrapCloze,
  type CardDraft,
  type CardField,
  type CardProblem,
  type EditableCardType,
  type TextSelection,
} from '../logic';
import { CardPreview } from './CardPreview';
import { FieldEditor } from './FieldEditor';

const s = strings.cards;
const log = createLogger('decks');

/** `cardId` "new" opens an empty card. */
export const NEW_CARD_ID = 'new';

function goBack(deckId: string) {
  if (router.canGoBack()) router.back();
  else router.replace({ pathname: '/deck/[id]', params: { id: deckId } });
}

/** The card editor route: loads the deck (and the card when editing), then shows the form. */
export function CardEditorScreen({ deckId, cardId }: { deckId: string; cardId: string }) {
  const isNew = cardId === NEW_CARD_ID;
  const { deck, loading: deckLoading } = useDeck(deckId);
  const { card, loading: cardLoading } = useCard(isNew ? '' : cardId);

  if (deckLoading || (!isNew && cardLoading)) return <View className="flex-1 bg-background" />;
  if (!deck || deck.deletedAt) {
    return (
      <Problem
        title={strings.decks.missingTitle}
        message={strings.decks.missingMessage}
        back={() => router.replace('/library')}
      />
    );
  }
  if (!isNew && (!card || card.deletedAt || card.deckId !== deck.id)) {
    return (
      <Problem title={s.missingTitle} message={s.missingMessage} back={() => goBack(deck.id)} />
    );
  }
  const draft = card ? cardToDraft(card) : emptyDraft();
  if (!draft) {
    return (
      <Problem
        title={s.types.image_occlusion}
        message={s.occlusionNotYet}
        back={() => goBack(deck.id)}
      />
    );
  }
  return (
    <CardEditorForm key={card?.id ?? 'new'} deck={deck} card={card ?? null} initialDraft={draft} />
  );
}

function Problem({ title, message, back }: { title: string; message: string; back: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 justify-center bg-background" style={{ paddingTop: insets.top }}>
      <EmptyState
        icon={FileX}
        title={title}
        message={message}
        actionLabel={s.back}
        onAction={back}
      />
    </View>
  );
}

type FieldKey = 'front' | 'back' | 'extra';

type Sheet = { type: 'image'; field: FieldKey } | { type: 'preview' };

function problemMessage(problem: CardProblem): string {
  switch (problem) {
    case 'answerTooLong':
      return s.problems.answerTooLong(TYPE_IN_ANSWER_MAX);
    case 'tooLong':
      return s.problems.tooLong(FIELD_TEXT_MAX);
    case 'tooManyImages':
      return s.problems.tooManyImages(FIELD_IMAGES_MAX);
    default:
      return s.problems[problem];
  }
}

/** Field labels and placeholders for each card type. */
function fieldCopy(type: EditableCardType) {
  switch (type) {
    case 'cloze':
      return { front: { label: s.fields.clozeText, placeholder: s.placeholders.clozeText } };
    case 'type_in':
      return {
        front: { label: s.fields.question, placeholder: s.placeholders.question },
        back: { label: s.fields.answer, placeholder: s.placeholders.answer },
      };
    default:
      return {
        front: { label: s.fields.front, placeholder: s.placeholders.front },
        back: { label: s.fields.back, placeholder: s.placeholders.back },
      };
  }
}

function CardEditorForm({
  deck,
  card,
  initialDraft,
}: {
  deck: Deck;
  card: Card | null;
  initialDraft: CardDraft;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const actions = useDeckActions();
  const addImage = useAddImage();
  const deleteMedia = useDeleteMedia();
  const scroll = useRef<ScrollView>(null);

  const [draft, setDraft] = useState<CardDraft>(initialDraft);
  const [saved, setSaved] = useState<CardDraft>(initialDraft);
  const [keepAdding, setKeepAdding] = useState(false);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  // Where the cursor is in the front field (the cloze buttons wrap the selection). `forced` is
  // only set right after a cloze is inserted, to put the cursor where it belongs.
  const selection = useRef<TextSelection>({ start: 0, end: 0 });
  const [forcedSelection, setForcedSelection] = useState<TextSelection | undefined>(undefined);
  // Images added while this screen is open: dropped again if the card isn't saved with them.
  const addedImages = useRef<string[]>([]);

  const isNew = card === null;
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const problem = cardDraftProblem(draft);
  const copy = fieldCopy(draft.type);

  const run = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      log.warn('Card change failed', { error: String(error) });
      toast.show({ message: strings.library.failed, tone: 'error' });
    }
  };

  const dropUnusedImages = useCallback(
    (kept: CardDraft | null) => {
      const keep = new Set(
        kept ? [...kept.front.mediaIds, ...kept.back.mediaIds, ...kept.extra.mediaIds] : [],
      );
      const unused = addedImages.current.filter((id) => !keep.has(id));
      addedImages.current = [];
      for (const id of unused) {
        deleteMedia(id).catch((error: unknown) =>
          log.warn('Could not drop an image', { error: String(error) }),
        );
      }
    },
    [deleteMedia],
  );

  const leave = useCallback(() => {
    if (!changed) {
      dropUnusedImages(null);
      goBack(deck.id);
      return;
    }
    Alert.alert(s.discardTitle, s.discardMessage, [
      { text: s.keepEditing, style: 'cancel' },
      {
        text: s.discard,
        style: 'destructive',
        onPress: () => {
          dropUnusedImages(null);
          goBack(deck.id);
        },
      },
    ]);
  }, [changed, deck.id, dropUnusedImages]);

  // Android's back button asks first when there are unsaved changes.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => sub.remove();
  }, [leave]);

  const setField = (key: FieldKey, field: CardField) => {
    setForcedSelection(undefined);
    setDraft((current) => ({ ...current, [key]: field }));
  };

  const setType = (type: EditableCardType) => setDraft((current) => ({ ...current, type }));

  const insertCloze = (same: boolean) => {
    const text = draft.front.text;
    const number = same ? lastClozeNumber(text) : nextClozeNumber(text);
    const result = wrapCloze(text, selection.current, number);
    selection.current = result.selection;
    setForcedSelection(result.selection);
    setDraft((current) => ({ ...current, front: { ...current.front, text: result.text } }));
  };

  const pickImage = (field: FieldKey, source: ImageSourceKind) =>
    run(async () => {
      setSheet(null);
      const result = await addImage(source);
      if (result.status === 'saved') {
        addedImages.current.push(result.media.id);
        setDraft((current) => ({
          ...current,
          [field]: { ...current[field], mediaIds: [...current[field].mediaIds, result.media.id] },
        }));
      } else if (result.status === 'permission-denied') {
        toast.show({ message: s.imageDenied });
      }
    });

  const save = () =>
    run(async () => {
      setTried(true);
      if (problem || saving) return;
      setSaving(true);
      try {
        if (card) await actions.updateCard(card.id, draft);
        else await actions.createCard(deck.id, draft);
        dropUnusedImages(draft);
        if (isNew && keepAdding) {
          const next = nextBulkDraft(draft);
          setDraft(next);
          setSaved(next);
          setTried(false);
          selection.current = { start: 0, end: 0 };
          setForcedSelection(undefined);
          scroll.current?.scrollTo({ y: 0, animated: true });
          toast.show({ message: s.addedNext, tone: 'success' });
        } else {
          setSaved(draft);
          toast.show({ message: isNew ? s.added : s.saved, tone: 'success' });
          goBack(deck.id);
        }
      } finally {
        setSaving(false);
      }
    });

  const deleteCard = () =>
    run(async () => {
      if (!card) return;
      const deletedAt = await actions.deleteCard(card.id);
      dropUnusedImages(null);
      goBack(deck.id);
      toast.show({
        message: s.deleted,
        actionLabel: strings.library.undo,
        onAction: () => void run(() => actions.restoreCard(card.id, deletedAt)),
      });
    });

  const clozeCount = useMemo(() => clozeNumbers(draft.front.text).length, [draft.front.text]);
  const lastNumber = lastClozeNumber(draft.front.text);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View className="flex-row items-center gap-1 px-1">
          <IconButton icon={ArrowLeft} accessibilityLabel={s.back} onPress={leave} />
          <View className="flex-1">
            <Text variant="heading" numberOfLines={1}>
              {isNew ? s.newTitle : s.editTitle}
            </Text>
            <Text variant="small" tone="muted" numberOfLines={1}>
              {deck.title}
            </Text>
          </View>
          <IconButton
            icon={Eye}
            accessibilityLabel={s.preview}
            onPress={() => setSheet({ type: 'preview' })}
          />
        </View>

        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-5 px-4 pb-6 pt-3"
        >
          <View className="gap-2">
            <Text variant="label">{s.typeLabel}</Text>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
              {editableCardTypes.map((type) => (
                <Chip
                  key={type}
                  label={s.types[type]}
                  selected={draft.type === type}
                  accessibilityRole="radio"
                  onPress={() => setType(type)}
                />
              ))}
            </View>
            <Text variant="small" tone="muted">
              {s.typeHints[draft.type]}
            </Text>
          </View>

          <FieldEditor
            label={copy.front.label}
            placeholder={copy.front.placeholder}
            field={draft.front}
            onChange={(field) => setField('front', field)}
            onAddImage={() => setSheet({ type: 'image', field: 'front' })}
            onViewImage={setViewing}
            minLines={draft.type === 'cloze' ? 5 : 3}
            selection={draft.type === 'cloze' ? forcedSelection : undefined}
            onSelectionChange={(next) => {
              selection.current = next;
            }}
            tools={
              draft.type === 'cloze' ? (
                <View className="gap-2">
                  <View className="flex-row flex-wrap gap-2">
                    <Button
                      label={s.clozeButton(nextClozeNumber(draft.front.text))}
                      icon={Scissors}
                      variant="secondary"
                      accessibilityHint={s.clozeButtonHint}
                      onPress={() => insertCloze(false)}
                    />
                    {clozeCount > 0 ? (
                      <Button
                        label={s.clozeSameButton(lastNumber)}
                        variant="outline"
                        accessibilityHint={s.clozeSameHint}
                        onPress={() => insertCloze(true)}
                      />
                    ) : null}
                  </View>
                  <Text variant="small" tone="muted">
                    {s.clozeHelp}
                  </Text>
                  <Text variant="label" accessibilityLiveRegion="polite">
                    {s.clozeCount(clozeCount)}
                  </Text>
                </View>
              ) : null
            }
          />

          {copy.back ? (
            <FieldEditor
              label={copy.back.label}
              placeholder={copy.back.placeholder}
              hint={draft.type === 'type_in' ? s.fieldHint.answer : undefined}
              singleLine={draft.type === 'type_in'}
              field={draft.back}
              onChange={(field) => setField('back', field)}
              onAddImage={
                draft.type === 'type_in'
                  ? undefined
                  : () => setSheet({ type: 'image', field: 'back' })
              }
              onViewImage={setViewing}
            />
          ) : null}

          <FieldEditor
            label={s.fields.extra}
            placeholder={s.placeholders.extra}
            hint={s.fieldHint.extra}
            field={draft.extra}
            onChange={(field) => setField('extra', field)}
            onAddImage={() => setSheet({ type: 'image', field: 'extra' })}
            onViewImage={setViewing}
            minLines={2}
          />

          {isNew ? (
            <View className="min-h-touch flex-row items-center gap-3">
              <View className="flex-1">
                <Text variant="bodyStrong">{s.keepAdding}</Text>
                <Text variant="small" tone="muted">
                  {s.keepAddingHint}
                </Text>
              </View>
              <Switch
                accessibilityLabel={s.keepAdding}
                accessibilityHint={s.keepAddingHint}
                value={keepAdding}
                onValueChange={setKeepAdding}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>
          ) : (
            <Button
              label={s.deleteCard}
              icon={Trash2}
              variant="ghost"
              onPress={() => void deleteCard()}
            />
          )}
        </ScrollView>

        <View
          className="gap-2 border-t border-border bg-surface px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          {tried && problem ? (
            <Text variant="small" tone="danger" accessibilityLiveRegion="polite">
              {problemMessage(problem)}
            </Text>
          ) : null}
          <View className="flex-row gap-3">
            <Button
              label={s.preview}
              icon={Eye}
              variant="outline"
              className="flex-1"
              onPress={() => setSheet({ type: 'preview' })}
            />
            <Button
              label={s.save}
              className="flex-1"
              loading={saving}
              onPress={() => void save()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      <BottomSheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet?.type === 'preview' ? s.previewTitle : s.addImageTitle}
      >
        {sheet?.type === 'image' ? (
          <View className="pb-2">
            <SheetAction
              icon={Images}
              label={s.fromGallery}
              onPress={() => void pickImage(sheet.field, 'library')}
            />
            <SheetAction
              icon={Camera}
              label={s.fromCamera}
              onPress={() => void pickImage(sheet.field, 'camera')}
            />
          </View>
        ) : null}
        {sheet?.type === 'preview' ? (
          <ScrollView style={{ maxHeight: 520 }}>
            <CardPreview draft={draft} />
          </ScrollView>
        ) : null}
      </BottomSheet>

      <MediaViewer id={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}
