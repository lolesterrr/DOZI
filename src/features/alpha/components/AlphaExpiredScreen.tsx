import { ScrollView } from 'react-native';

import { Text } from '@/components/ui';
import { Dozi } from '@/features/mascot';
import { strings } from '@/i18n/strings';

const s = strings.alphaExpiry;

/** Shown instead of the whole app once the alpha has expired. There is no way past it. */
export function AlphaExpiredScreen() {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="flex-grow items-center justify-center gap-4 px-6 py-16"
    >
      <Dozi mood="sleepy" />
      <Text variant="title" className="text-center">
        {s.expiredTitle}
      </Text>
      <Text className="max-w-[320px] text-center">{s.expiredMessage}</Text>
      <Text tone="muted" className="max-w-[320px] text-center">
        {s.expiredThanks}
      </Text>
    </ScrollView>
  );
}
