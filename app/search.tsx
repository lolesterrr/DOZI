import { Search } from 'lucide-react-native';

import { PlaceholderScreen } from '@/features/shell';
import { strings } from '@/i18n/strings';

// Global search (opened from the header of every tab). Placeholder until task 1.4 adds search.
export default function SearchScreen() {
  return (
    <PlaceholderScreen
      icon={Search}
      title={strings.search.placeholderTitle}
      message={strings.search.placeholderMessage}
    />
  );
}
