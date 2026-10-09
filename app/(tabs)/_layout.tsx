import { Tabs } from 'expo-router';

import { HeaderSearchButton, tabIcons, tabRoutes } from '@/features/shell';
import { strings } from '@/i18n/strings';
import { fontFamilies, useTheme } from '@/theme';

// Bottom tabs: Today · Learn · Practice · Library · Me (PRODUCT_SPEC §2).
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.fg,
        headerTitleStyle: { fontFamily: fontFamilies.heading },
        headerShadowVisible: false,
        headerRight: () => <HeaderSearchButton />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors['fg-muted'],
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fontFamilies['body-medium'] },
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
              tabBarIcon: ({ color, size }) => <Icon color={color} size={size} />,
            }}
          />
        );
      })}
    </Tabs>
  );
}
