import { View } from 'react-native';

import { ScreenHeader } from '@/components/ui';
import { HeaderSearchButton, PlaceholderScreen, tabIcons } from '@/features/shell';
import { strings } from '@/i18n/strings';

// Learn tab. Placeholder until its feature tasks are built.
export default function LearnScreen() {
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={strings.tabs.learn} right={<HeaderSearchButton />} />
      <PlaceholderScreen
        icon={tabIcons.learn}
        title={strings.placeholders.learn.title}
        message={strings.placeholders.learn.message}
      />
    </View>
  );
}
