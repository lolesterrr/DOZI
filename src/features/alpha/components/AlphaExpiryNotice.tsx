import { Modal, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { Dozi } from '@/features/mascot';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';
import { schemeVars } from '@/theme/ThemeProvider';

import { useAlphaNotice } from '../hooks';
import { formatAlphaExpiry } from '../logic';

const s = strings.alphaExpiry;

/** Tells a tester, once per build, the date this alpha stops working. */
export function AlphaExpiryNotice() {
  const { scheme } = useTheme();
  const { visible, expiresOn, dismiss } = useAlphaNotice();
  if (!visible || !expiresOn) return null;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      {/* Modals render in their own window, so re-apply the theme variables here. */}
      <View
        style={[{ flex: 1 }, schemeVars[scheme]]}
        className="items-center justify-center bg-scrim/50 px-6"
      >
        <Card className="w-full max-w-[360px] items-center gap-3">
          <Dozi mood="encouraging" size={96} />
          <Text variant="heading" className="text-center">
            {s.noticeTitle}
          </Text>
          <Text className="text-center">{s.noticeMessage(formatAlphaExpiry(expiresOn))}</Text>
          <Text variant="small" tone="muted" className="text-center">
            {s.noticeData}
          </Text>
          <Button label={s.noticeOk} onPress={dismiss} fullWidth className="mt-2" />
        </Card>
      </View>
    </Modal>
  );
}
