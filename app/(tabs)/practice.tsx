import { PlaceholderScreen, tabIcons } from '@/features/shell';
import { strings } from '@/i18n/strings';

// Practice tab. Placeholder until its feature tasks are built.
export default function PracticeScreen() {
  return (
    <PlaceholderScreen
      icon={tabIcons.practice}
      title={strings.placeholders.practice.title}
      message={strings.placeholders.practice.message}
    />
  );
}
