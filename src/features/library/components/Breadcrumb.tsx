import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Fragment } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import type { Folder } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

/**
 * "Library › Pharm I › ANS": where this folder sits. Tapping a step goes back up to it.
 * `path` runs from the top level down to the current folder (see `folderPath`).
 */
export function Breadcrumb({ path }: { path: readonly Folder[] }) {
  const { colors } = useTheme();
  const steps = [
    { id: null as string | null, name: strings.library.topLevel },
    ...path.map((f) => ({ id: f.id as string | null, name: f.name })),
  ];
  return (
    <View
      accessibilityLabel={`${strings.library.breadcrumbLabel}: ${steps.map((s) => s.name).join(', ')}`}
      className="flex-row flex-wrap items-center gap-x-1 px-4"
    >
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <Fragment key={step.id ?? 'top'}>
            {last ? (
              <Text variant="label" numberOfLines={1} className="py-2.5">
                {step.name}
              </Text>
            ) : (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={step.name}
                hitSlop={4}
                className="min-h-touch justify-center active:opacity-70"
                onPress={() =>
                  step.id
                    ? router.dismissTo({ pathname: '/folder/[id]', params: { id: step.id } })
                    : router.dismissTo('/library')
                }
              >
                <Text variant="label" tone="primary" numberOfLines={1}>
                  {step.name}
                </Text>
              </Pressable>
            )}
            {last ? null : <ChevronRight color={colors['fg-muted']} size={16} />}
          </Fragment>
        );
      })}
    </View>
  );
}
