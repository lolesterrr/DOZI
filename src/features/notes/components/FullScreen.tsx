import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';
import { schemeVars } from '@/theme/ThemeProvider';

/**
 * A screen that slides up over the note (the mnemonic maker, "note done"): its own window, so
 * the theme is applied again here. Closing it (✕ or Android back) calls `onClose`.
 */
export function FullScreen({
  visible,
  title,
  subtitle,
  onClose,
  background,
  children,
}: {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  /** A fill for the whole screen, e.g. a course colour. */
  background?: string;
  children: ReactNode;
}) {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          { flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom },
          schemeVars[scheme],
          background ? { backgroundColor: background } : null,
        ]}
        className={background ? undefined : 'bg-background'}
      >
        <View className="flex-row items-center gap-2 px-3 pb-1 pt-2">
          <IconButton icon={X} accessibilityLabel={strings.common.close} onPress={onClose} />
          {title ? (
            <View className="flex-1">
              <Text variant="heading" accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? (
                <Text variant="small" tone="muted" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
        {children}
      </View>
    </Modal>
  );
}
