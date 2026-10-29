import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from 'expo-router';
import { vars } from 'nativewind';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';

import { cssVariables, palettes, type ColorScheme, type Palette } from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  /** What the user chose (Settings will persist this from task 0.6 onwards). */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Extra text size on top of the phone's own setting (1 = none). */
  textScale: number;
  setTextScale: (scale: number) => void;
  /** The scheme actually shown. */
  scheme: ColorScheme;
  /** Hex colours for places a className can't reach (icon colours, SVG strokes). */
  colors: Palette;
  navigationTheme: NavigationTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Built once: the CSS variables NativeWind classes like `bg-surface` read.
export const schemeVars = {
  light: vars(cssVariables('light')),
  dark: vars(cssVariables('dark')),
};

function buildNavigationTheme(scheme: ColorScheme): NavigationTheme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const p = palettes[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: p.primary,
      background: p.background,
      card: p.surface,
      text: p.fg,
      border: p.border,
      notification: p.danger,
    },
  };
}

export function ThemeProvider({
  children,
  initialPreference = 'system',
}: {
  children: ReactNode;
  initialPreference?: ThemePreference;
}) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>(initialPreference);
  const [textScale, setTextScale] = useState(1);
  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      setPreference,
      textScale,
      setTextScale,
      scheme,
      colors: palettes[scheme],
      navigationTheme: buildNavigationTheme(scheme),
    }),
    [preference, scheme, textScale],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, schemeVars[scheme]]}>{children}</View>
    </ThemeContext.Provider>
  );
}

/** The extra text size setting; 1 (no change) outside a ThemeProvider. */
export function useTextScale(): number {
  return useContext(ThemeContext)?.textScale ?? 1;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return value;
}
