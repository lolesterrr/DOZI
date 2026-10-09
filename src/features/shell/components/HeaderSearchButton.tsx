import { router } from 'expo-router';
import { Search } from 'lucide-react-native';

import { IconButton } from '@/components/ui';
import { strings } from '@/i18n/strings';

/** The search button in every tab's header. Opens the global search screen. */
export function HeaderSearchButton() {
  return (
    <IconButton
      icon={Search}
      accessibilityLabel={strings.search.open}
      onPress={() => router.push('/search')}
      className="mr-2"
    />
  );
}
