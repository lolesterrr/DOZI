import { router } from 'expo-router';
import { Layers, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BottomSheet, Text, useToast } from '@/components/ui';
import { useDeckActions, useDecks } from '@/features/decks/hooks';
import { deckTitleMessage } from '@/features/decks/messages';
import { openCardEditor } from '@/features/decks/navigation';
import { NameForm } from '@/features/library/components/NameForm';
import { SheetAction } from '@/features/library/components/SheetAction';
import { TemplatePicker } from '@/features/notes/components/TemplatePicker';
import { useNoteActions } from '@/features/notes/hooks';
import type { NoteTemplate } from '@/features/notes/templates';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme';

import { createActionIcons } from '../icons';
import { createActions, type CreateAction } from '../logic';

const log = createLogger('shell');

/**
 * The floating "+ Create" button (Today and Library tabs) and its action sheet.
 * "New note" asks for a template, then opens the note (tasks 1.3, 1.4). "New deck" asks for a
 * name and opens the deck; "New card" asks which deck (or for a first deck's name) and opens the
 * card editor (task 1.6). The other actions show a "coming soon" toast until their tasks.
 */
export function CreateButton() {
  const { colors } = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  // The sheet first lists the actions; some of them switch it to a second step.
  const [step, setStep] = useState<'actions' | 'template' | 'deckName' | 'cardDeck'>('actions');

  const notes = useNoteActions();
  const deckActions = useDeckActions();
  const decks = useDecks();

  const close = () => {
    setOpen(false);
    setStep('actions');
  };

  const fail = (what: string) => (error: unknown) => {
    log.warn(what, { error: String(error) });
    toast.show({ message: strings.library.failed, tone: 'error' });
  };

  /** Makes a deck at the top level, then opens it (or its card editor, for "New card"). */
  const createDeck = (title: string) =>
    deckActions
      .createDeck(title)
      .then((deck) => {
        const forCard = step === 'cardDeck';
        close();
        if (forCard) openCardEditor(deck.id, 'new');
        else router.push({ pathname: '/deck/[id]', params: { id: deck.id } });
      })
      .catch(fail('Could not create a deck'));

  const createNote = (template: NoteTemplate | null) => {
    close();
    notes
      .create(null, template)
      .then((note) => router.push({ pathname: '/note/[id]', params: { id: note.id } }))
      .catch((error: unknown) => {
        log.warn('Could not create a note', { error: String(error) });
        toast.show({ message: strings.library.failed, tone: 'error' });
      });
  };

  const onAction = (action: CreateAction) => {
    if (action === 'note') {
      setStep('template');
      return;
    }
    if (action === 'deck') {
      setStep('deckName');
      return;
    }
    if (action === 'card') {
      setStep('cardDeck');
      return;
    }
    close();
    toast.show({ message: strings.create.comingSoon });
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings.create.button}
        onPress={() => setOpen(true)}
        className="absolute bottom-4 right-4 min-h-touch flex-row items-center gap-2 rounded-full bg-primary px-5 py-3 active:opacity-80"
        style={{ elevation: 4 }}
      >
        <Plus color={colors['on-primary']} size={22} />
        <Text variant="bodyStrong" tone="onPrimary">
          {strings.create.button}
        </Text>
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={close}
        title={
          step === 'template'
            ? strings.notes.templateTitle
            : step === 'deckName'
              ? strings.decks.newDeckTitle
              : step === 'cardDeck'
                ? strings.decks.pickDeckTitle
                : strings.create.sheetTitle
        }
      >
        {step === 'template' ? <TemplatePicker onPick={createNote} /> : null}
        {step === 'deckName' || (step === 'cardDeck' && decks.length === 0) ? (
          <View className="gap-3">
            {step === 'cardDeck' ? (
              <Text variant="body" tone="muted">
                {strings.decks.noDecksYet}
              </Text>
            ) : null}
            <NameForm
              placeholder={strings.decks.titlePlaceholder}
              submitLabel={strings.library.create}
              validate={deckTitleMessage}
              onCancel={close}
              onSubmit={createDeck}
            />
          </View>
        ) : null}
        {step === 'cardDeck' && decks.length > 0 ? (
          <ScrollView style={{ maxHeight: 420 }} contentContainerClassName="pb-2">
            {decks.map((deck) => (
              <SheetAction
                key={deck.id}
                icon={Layers}
                label={deck.title}
                onPress={() => {
                  close();
                  openCardEditor(deck.id, 'new');
                }}
              />
            ))}
          </ScrollView>
        ) : null}
        {step === 'actions' ? (
          <View className="pb-2">
            {createActions.map((action) => {
              const Icon = createActionIcons[action];
              return (
                <Pressable
                  key={action}
                  accessibilityRole="button"
                  onPress={() => onAction(action)}
                  className="min-h-touch flex-row items-center gap-4 rounded-md px-2 py-3 active:bg-surface-muted"
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
                    <Icon color={colors['on-primary-soft']} size={22} />
                  </View>
                  <Text variant="body" className="flex-1">
                    {strings.create.actions[action]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}
