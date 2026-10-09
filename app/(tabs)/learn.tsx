import { PlaceholderScreen, tabIcons } from '@/features/shell';
import { strings } from '@/i18n/strings';

// Learn tab. Placeholder until its feature tasks are built.
export default function LearnScreen() {
  return (
    <PlaceholderScreen
      icon={tabIcons.learn}
      title={strings.placeholders.learn.title}
      message={strings.placeholders.learn.message}
    />
  );
}
