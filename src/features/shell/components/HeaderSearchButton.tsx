import { router } from 'expo-router';
import { Search } from 'lucide-react-native';

import { IconButton } from '@/components/ui';
import { strings } from '@/i18n/strings';

/** The search button in the tabs' top bars. Opens the global search screen. */
export function HeaderSearchButton() {
  return (
    <IconButton
      icon={Search}
      accessibilityLabel={strings.search.open}
      variant="soft"
      onPress={() => router.push('/search')}
    />
  );
}
