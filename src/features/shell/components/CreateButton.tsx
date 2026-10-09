import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomSheet, Text, useToast } from '@/components/ui';
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
 * "New note" asks for a template, then opens the note (tasks 1.3, 1.4); the other actions show a
 * "coming soon" toast until their tasks.
 */
export function CreateButton() {
  const { colors } = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  // The sheet first lists the actions; "New note" switches it to the template choice.
  const [pickingTemplate, setPickingTemplate] = useState(false);

  const notes = useNoteActions();

  const close = () => {
    setOpen(false);
    setPickingTemplate(false);
  };

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
      setPickingTemplate(true);
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
        title={pickingTemplate ? strings.notes.templateTitle : strings.create.sheetTitle}
      >
        {pickingTemplate ? (
          <TemplatePicker onPick={createNote} />
        ) : (
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
        )}
      </BottomSheet>
    </>
  );
}
