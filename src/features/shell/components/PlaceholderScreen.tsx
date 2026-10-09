import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui';

export type PlaceholderScreenProps = {
  icon: LucideIcon;
  title: string;
  message: string;
  /** Extra content on top of the screen, such as the floating "+ Create" button. */
  children?: ReactNode;
};

/** A friendly "coming soon" screen for tabs and routes that later tasks will fill in. */
export function PlaceholderScreen({ icon, title, message, children }: PlaceholderScreenProps) {
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1 justify-center">
        <EmptyState icon={icon} title={title} message={message} />
      </View>
      {children}
    </View>
  );
}
