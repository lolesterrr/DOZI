import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';
import { schemeVars } from '@/theme/ThemeProvider';

import { IconButton } from './IconButton';
import { Text } from './Text';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/**
 * A panel that slides up from the bottom. Closes on the backdrop, the X button or the Android
 * back button. Built on React Native's Modal, so it needs no extra library.
 */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/* Modals render in their own window, so re-apply the theme variables here. */}
      <View style={[{ flex: 1 }, schemeVars[scheme]]} className="justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.common.close}
          onPress={onClose}
          className="absolute inset-0 bg-scrim/50"
        />
        {/* Sheets can hold text fields; lift the sheet above the on-screen keyboard. The modal
            window is edge-to-edge, so Android doesn't resize it for the keyboard by itself. */}
        <KeyboardAvoidingView behavior="padding">
          <Animated.View entering={SlideInDown.duration(220)}>
            <View
              accessibilityViewIsModal
              className="rounded-t-xl bg-surface px-5 pt-2"
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              <View className="mb-2 h-1 w-10 self-center rounded-full bg-border" />
              <View className="mb-2 flex-row items-center justify-between">
                <Text variant="heading" className="flex-1">
                  {title ?? ''}
                </Text>
                <IconButton icon={X} accessibilityLabel={strings.common.close} onPress={onClose} />
              </View>
              {children}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
