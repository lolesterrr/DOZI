import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { IconButton, ScreenHeader } from '@/components/ui';
import { strings } from '@/i18n/strings';

/**
 * The doodle top bar for pushed screens that use the stack's header (search, folders, stats,
 * settings, tutorials…): a square back button, the screen's title in the middle, and any
 * `headerRight` the screen sets.
 */
/** The parts of the stack's header props this bar uses. */
export type StackHeaderProps = {
  options: {
    title?: string;
    headerRight?: (props: { canGoBack: boolean; tintColor?: string }) => ReactNode;
  };
  back?: unknown;
};

export function StackHeader({ options, back }: StackHeaderProps) {
  const title = options.title ?? '';
  return (
    <ScreenHeader
      title={title}
      left={
        back ? (
          <IconButton
            icon={ArrowLeft}
            variant="soft"
            accessibilityLabel={strings.library.back}
            onPress={() => router.back()}
          />
        ) : null
      }
      right={options.headerRight?.({ canGoBack: !!back })}
    />
  );
}
