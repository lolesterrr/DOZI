import { PlaceholderScreen, tabIcons, CreateButton } from '@/features/shell';
import { strings } from '@/i18n/strings';

// Library tab. Placeholder until its feature tasks are built.
export default function LibraryScreen() {
  return (
    <PlaceholderScreen
      icon={tabIcons.library}
      title={strings.placeholders.library.title}
      message={strings.placeholders.library.message}
    >
      <CreateButton />
    </PlaceholderScreen>
  );
}
