import { PlaceholderScreen, tabIcons } from '@/features/shell';
import { strings } from '@/i18n/strings';

// Me tab. Placeholder until its feature tasks are built.
export default function MeScreen() {
  return (
    <PlaceholderScreen
      icon={tabIcons.me}
      title={strings.placeholders.me.title}
      message={strings.placeholders.me.message}
    />
  );
}
