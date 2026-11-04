// Design tokens: the single source of truth for colours, spacing, radius and type.
// Components use these through NativeWind classes (see tailwind.config.js) or, where a class
// can't reach (icon colours, SVG strokes), through `useTheme().colors`.
//
// Direction ("doodle", trial branch): ink outlines on white cards, a deep teal primary, a soft
// orange accent that also paints the coloured layer under cards and buttons, cool grey neutrals.
// Every text/background pair is checked for WCAG AA contrast in src/theme/__tests__.

export type ColorScheme = 'light' | 'dark';

export const colorNames = [
  'background', // screen background
  'surface', // cards, sheets, inputs
  'surface-muted', // subtle fills: chips, skeletons, progress tracks
  'border', // light dividers and hairlines
  'outline', // the ink line drawn around cards, buttons, chips and inputs (doodle look)
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
    background: '#F6F7FA',
    surface: '#FFFFFF',
    'surface-muted': '#ECEEF3',
    border: '#D9DCE4',
    outline: '#1D1D22',
    fg: '#1D1D22',
    'fg-muted': '#55576A',
    primary: '#13737B',
    'on-primary': '#FFFFFF',
    'primary-soft': '#CFEDEF',
    'on-primary-soft': '#0A4A50',
    accent: '#F9B572',
    'on-accent': '#2A1800',
    'accent-soft': '#FDE6CC',
    'on-accent-soft': '#6B3A00',
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
    inverse: '#1D1D22',
    'on-inverse': '#F6F7FA',
    scrim: '#000000',
  },
  dark: {
    background: '#15161B',
    surface: '#1F2027',
    'surface-muted': '#2A2B33',
    border: '#3A3B45',
    outline: '#CFCCDA',
    fg: '#F1F1F5',
    'fg-muted': '#B3B3C0',
    primary: '#5CC8D0',
    'on-primary': '#062A2D',
    'primary-soft': '#133A3E',
    'on-primary-soft': '#B5EBEF',
    accent: '#F9B572',
    'on-accent': '#2A1800',
    'accent-soft': '#3D2A14',
    'on-accent-soft': '#FBD3A6',
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
    inverse: '#F1F1F5',
    'on-inverse': '#1D1D22',
    scrim: '#000000',
  },
};

// Course colours for the timetable (PRODUCT_SPEC §13). Each has a soft `fill` for the class
// block, `ink` for text on that fill (AA-checked in src/theme/__tests__) and a strong `bar` for the
// stripe and dots. Components look them up by name with `useTheme().scheme`.
export const courseColourNames = [
  'teal',
  'blue',
  'violet',
  'rose',
  'coral',
  'amber',
  'green',
  'slate',
] as const;
export type CourseColour = (typeof courseColourNames)[number];
export type CourseSwatch = { fill: string; ink: string; bar: string };

export const coursePalettes: Record<ColorScheme, Record<CourseColour, CourseSwatch>> = {
  light: {
    teal: { fill: '#D5ECE9', ink: '#064744', bar: '#0B6B68' },
    blue: { fill: '#DCE8FB', ink: '#123E7A', bar: '#2F6FD0' },
    violet: { fill: '#E9E1FA', ink: '#3F2A7A', bar: '#7353C9' },
    rose: { fill: '#FBE0EA', ink: '#7A1840', bar: '#C93A73' },
    coral: { fill: '#FDE3DA', ink: '#7A2810', bar: '#E0603A' },
    amber: { fill: '#FAEDCF', ink: '#5A3F00', bar: '#E3A72F' },
    green: { fill: '#DCF1E2', ink: '#0F4A22', bar: '#1D7A3B' },
    slate: { fill: '#E4E7EC', ink: '#2A3340', bar: '#5B6878' },
  },
  dark: {
    teal: { fill: '#123A37', ink: '#A9E5DF', bar: '#4CC2BA' },
    blue: { fill: '#15284A', ink: '#B5CEF6', bar: '#6A9BEA' },
    violet: { fill: '#261D45', ink: '#D2C4F7', bar: '#9A80E6' },
    rose: { fill: '#3D1729', ink: '#F7BCD3', bar: '#E5769F' },
    coral: { fill: '#3D1E14', ink: '#FBC4B0', bar: '#F08A66' },
    amber: { fill: '#3A2F13', ink: '#F6D98F', bar: '#F2C352' },
    green: { fill: '#16331F', ink: '#A6E6B8', bar: '#5CC97C' },
    slate: { fill: '#252A31', ink: '#CDD3DC', bar: '#8D99A8' },
  },
};

/** A course colour's swatch; an unknown name (e.g. from an older version) falls back to teal. */
export function courseSwatch(scheme: ColorScheme, colour: string): CourseSwatch {
  const known = (courseColourNames as readonly string[]).includes(colour);
  return coursePalettes[scheme][known ? (colour as CourseColour) : 'teal'];
}

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
  heading: 'Poppins_600SemiBold',
  'heading-black': 'Poppins_700Bold',
  body: 'Poppins_400Regular',
  'body-medium': 'Poppins_500Medium',
  'body-semibold': 'Poppins_600SemiBold',
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

/**
 * Pen colours for drawing on images (task 1.5). They are burnt into the saved picture, so they
 * don't change with light/dark mode. `halo` is the outline drawn around text labels so they stay
 * readable on both light and dark photos.
 */
export const annotationColourNames = ['red', 'yellow', 'green', 'blue', 'black'] as const;
export type AnnotationColourName = (typeof annotationColourNames)[number];

export const annotationColours: Record<AnnotationColourName, { pen: string; halo: string }> = {
  red: { pen: '#E5322D', halo: '#FFFFFF' },
  yellow: { pen: '#FFD60A', halo: '#1F1B16' },
  green: { pen: '#1FA34A', halo: '#FFFFFF' },
  blue: { pen: '#1D6FE0', halo: '#FFFFFF' },
  black: { pen: '#1F1B16', halo: '#FFFFFF' },
};
