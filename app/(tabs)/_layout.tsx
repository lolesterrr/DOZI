import { Redirect, Tabs } from 'expo-router';

import { useOnboardingGate } from '@/features/onboarding';
import { NotchTabBar, tabIcons, tabRoutes } from '@/features/shell';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

// Bottom tabs: Today · Learn · Practice · Library · Me (PRODUCT_SPEC §2).
// Doodle look: a teal bar with an ink outline and a dip in its top edge under the current tab,
// whose icon floats in an orange circle with its name underneath. Switching tabs slides the dip
// across (NotchTabBar). Screen readers hear every tab's name.
export default function TabsLayout() {
  const { colors } = useTheme();
  const gate = useOnboardingGate();
  // A fresh install starts with onboarding (task 2.8); nothing shows while we check.
  if (gate === 'loading') return null;
  if (gate === 'needed') return <Redirect href="/onboarding" />;
  return (
    <Tabs
      tabBar={(props) => <NotchTabBar {...props} icons={tabIcons} labels={strings.tabs} />}
      screenOptions={{
        // Each tab draws its own doodle top bar (ScreenHeader).
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {tabRoutes.map((route) => (
        <Tabs.Screen
          key={route}
          name={route}
          options={{ title: strings.tabs[route], tabBarAccessibilityLabel: strings.tabs[route] }}
        />
      ))}
    </Tabs>
  );
}
