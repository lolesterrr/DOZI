import { TodayScreen } from '@/features/today';
import { CreateButton } from '@/features/shell';
import { View } from 'react-native';

// Today tab (PRODUCT_SPEC §2): Dozi's greeting, the daily goal and streak, reviews due and
// recent items. The "+ Create" button floats over it.
export default function TodayRoute() {
  return (
    <View className="flex-1 bg-background">
      <TodayScreen />
      <CreateButton />
    </View>
  );
}
