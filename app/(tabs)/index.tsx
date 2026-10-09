import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { CreateButton } from '@/features/shell';
import { strings } from '@/i18n/strings';

// Today tab. Placeholder until the real home screen (streak, goal ring, plan) is built.
export default function TodayScreen() {
  return (
    <View className="flex-1 bg-background p-6">
      <View className="flex-1 items-center justify-center gap-2">
        <Text variant="display">{strings.today.greeting}</Text>
        <Text tone="muted" className="text-center">
          {strings.today.tagline}
        </Text>
        {__DEV__ ? (
          <Button
            label={strings.today.openGallery}
            variant="outline"
            onPress={() => router.push('/dev/ui')}
            className="mt-6"
          />
        ) : null}
      </View>
      <Text variant="caption" tone="muted" className="mb-16 text-center">
        {strings.disclaimer}
      </Text>
      <CreateButton />
    </View>
  );
}
