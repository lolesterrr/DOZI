// Design tokens: the single source of truth for colours, spacing, radius and type.
// Components use these through NativeWind classes (see tailwind.config.js) or, where a class
// can't reach (icon colours, SVG strokes), through `useTheme().colors`.
//
// Direction: deep teal primary, crane-gold accent (the grey crowned crane's crown), warm neutrals.
// Every text/background pair is checked for WCAG AA contrast in src/theme/__tests__.

export type ColorScheme = 'light' | 'dark';

export const colorNames = [
  'background', // screen background
  'surface', // cards, sheets, inputs
  'surface-muted', // subtle fills: chips, skeletons, progress tracks
  'border',
  'fg', // main text
  'fg-muted', // secondary text, hints, placeholders
  'primary',
  'on-primary', // text/icons on primary
  'primary-soft', // tinted background (selected chip)
  'on-primary-soft',
  'accent',
  'on-accent',
  'accent-soft',
  'on-accent-soft',
  'success',
  'on-success',
  'success-soft',
  'on-success-soft',
  'danger',
  'on-danger',
  'danger-soft',
  'on-danger-soft',
  'warning-soft',
  'on-warning-soft',
  'inverse', // toast background
  'on-inverse',
  'scrim', // dimmed backdrop behind sheets
] as const;

export type ColorName = (typeof colorNames)[number];
export type Palette = Record<ColorName, string>;

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    background: '#FAF7F2',
    surface: '#FFFFFF',
    'surface-muted': '#F0EBE3',
    border: '#DDD5C9',
    fg: '#1F1B16',
    'fg-muted': '#5E564C',
    primary: '#0B6B68',
    'on-primary': '#FFFFFF',
    'primary-soft': '#D5ECE9',
    'on-primary-soft': '#064744',
    accent: '#E3A72F',
    'on-accent': '#2B1F04',
    'accent-soft': '#FAEDCF',
    'on-accent-soft': '#5A3F00',
    success: '#1D7A3B',
    'on-success': '#FFFFFF',
    'success-soft': '#DCF1E2',
    'on-success-soft': '#0F4A22',
    danger: '#B42318',
    'on-danger': '#FFFFFF',
    'danger-soft': '#FBE3E0',
    'on-danger-soft': '#7A1710',
    'warning-soft': '#FCEFD0',
    'on-warning-soft': '#6A4500',
    inverse: '#2A2620',
    'on-inverse': '#F7F3EC',
    scrim: '#000000',
  },
  dark: {
    background: '#14120F',
    surface: '#1F1C18',
    'surface-muted': '#2B2721',
    border: '#3D372F',
    fg: '#F3EEE7',
    'fg-muted': '#B8AEA2',
    primary: '#4CC2BA',
    'on-primary': '#04211F',
    'primary-soft': '#123A37',
    'on-primary-soft': '#A9E5DF',
    accent: '#F2C352',
    'on-accent': '#2B1F04',
    'accent-soft': '#3A2F13',
    'on-accent-soft': '#F6D98F',
    success: '#5CC97C',
    'on-success': '#06230F',
    'success-soft': '#16331F',
    'on-success-soft': '#A6E6B8',
    danger: '#FF8C82',
    'on-danger': '#3A0905',
    'danger-soft': '#3D1814',
    'on-danger-soft': '#FFC2BC',
    'warning-soft': '#3A2C10',
    'on-warning-soft': '#F5D08A',
    inverse: '#F3EEE7',
    'on-inverse': '#1F1B16',
    scrim: '#000000',
  },
};

/** '#0B6B68' → '11 107 104' (the format the CSS variables in global.css use). */
export function hexToRgbChannels(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** CSS variables for one colour scheme, e.g. { '--color-primary': '11 107 104', … }. */
export function cssVariables(scheme: ColorScheme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const name of colorNames) {
    vars[`--color-${name}`] = hexToRgbChannels(palettes[scheme][name]);
  }
  return vars;
}

// 4-dp grid. Tailwind's default spacing scale (p-1 = 4, p-4 = 16…) matches this.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

/** Minimum touch target (dp) — CLAUDE.md accessibility rule. */
export const minTouchTarget = 44;

// Font family names as registered by @expo-google-fonts (see src/theme/fonts.ts).
export const fontFamilies = {
  heading: 'Nunito_700Bold',
  'heading-black': 'Nunito_800ExtraBold',
  body: 'Inter_400Regular',
  'body-medium': 'Inter_500Medium',
  'body-semibold': 'Inter_600SemiBold',
} as const;

// Type scale: [fontSize, lineHeight] in dp. Sizes scale with the system font size setting.
export const typeScale = {
  display: { fontSize: 32, lineHeight: 40 },
  title: { fontSize: 24, lineHeight: 32 },
  heading: { fontSize: 20, lineHeight: 28 },
  subheading: { fontSize: 17, lineHeight: 24 },
  body: { fontSize: 16, lineHeight: 24 },
  small: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
} as const;
