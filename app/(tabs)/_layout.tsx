import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useOnboardingGate } from '@/features/onboarding';
import { tabIcons, tabRoutes } from '@/features/shell';
import { strings } from '@/i18n/strings';
import { doodleLayer, useTheme } from '@/theme';

// Bottom tabs: Today · Learn · Practice · Library · Me (PRODUCT_SPEC §2).
// Doodle look: the tab bar is a chunky teal pill of icons floating above the bottom edge, with an
// ink outline and an orange layer underneath; the current tab's icon sits in an orange square.
// Only the current tab shows its name; screen readers hear every tab's name.
export default function TabsLayout() {
  const { colors, scheme } = useTheme();
  // Dark mode keeps big areas quiet: a muted teal bar with light icons instead of bright teal.
  const barColour = scheme === 'dark' ? colors['layer-primary'] : colors.primary;
  const iconColour = scheme === 'dark' ? colors.fg : colors['on-primary'];
  const insets = useSafeAreaInsets();
  const gate = useOnboardingGate();
  // A fresh install starts with onboarding (task 2.8); nothing shows while we check.
  if (gate === 'loading') return null;
  if (gate === 'needed') return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        // Each tab draws its own doodle top bar (ScreenHeader).
        headerShown: false,
        tabBarActiveTintColor: iconColour,
        tabBarInactiveTintColor: iconColour,
        tabBarStyle: {
          backgroundColor: barColour,
          borderWidth: 2,
          borderTopWidth: 2,
          borderColor: colors.outline,
          borderTopColor: colors.outline,
          borderRadius: 22,
          marginHorizontal: 12,
          marginBottom: insets.bottom + 10,
          height: 74,
          paddingTop: 8,
          paddingBottom: 8,
          ...doodleLayer(colors, 'ink', 6),
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {tabRoutes.map((route) => {
        const Icon = tabIcons[route];
        return (
          <Tabs.Screen
            key={route}
            name={route}
            options={{
              title: strings.tabs[route],
              tabBarAccessibilityLabel: strings.tabs[route],
              // Only the current tab shows its name, under its orange square.
              tabBarLabel: ({ focused, color }) =>
                focused ? (
                  <Text variant="caption" tone="inherit" style={{ color }} numberOfLines={1}>
                    {strings.tabs[route]}
                  </Text>
                ) : null,
              tabBarIcon: ({ color, focused }) =>
                focused ? (
                  <View className="h-10 w-14 items-center justify-center rounded-2xl border-2 border-outline bg-accent">
                    <Icon color={colors['on-accent']} size={22} />
                  </View>
                ) : (
                  <Icon color={color} size={22} />
                ),
            }}
          />
        );
      })}
    </Tabs>
  );
}
