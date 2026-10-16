import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { strings } from '@/i18n/strings';
import { palettes } from '@/theme';

/**
 * Shown while the app starts (fonts loading), before ThemeProvider exists, so it reads the palette
 * directly. It replaces a blank screen: in a dev build a plain white screen means the JavaScript
 * never arrived from Metro, while this spinner means it did and the app is starting.
 */
export function StartupScreen() {
  const colors = palettes[useColorScheme() === 'dark' ? 'dark' : 'light'];
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} accessibilityLabel={strings.startup} />
    </View>
  );
}
