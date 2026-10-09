import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomSheet, Text, useToast } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { createActionIcons } from '../icons';
import { createActions, type CreateAction } from '../logic';

/**
 * The floating "+ Create" button (Today and Library tabs) and its action sheet.
 * The actions are stubs for now: each one shows a "coming soon" toast.
 */
export function CreateButton() {
  const { colors } = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const onAction = (_action: CreateAction) => {
    setOpen(false);
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

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={strings.create.sheetTitle}>
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
      </BottomSheet>
    </>
  );
}
