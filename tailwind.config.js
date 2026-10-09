// Tailwind (NativeWind) config. Colours are CSS variables so light/dark switch at runtime:
// the values live in src/theme/tokens.ts and are applied by src/theme/ThemeProvider.tsx.
// Keep `colorNames` below in sync with tokens.ts (a unit test checks this).
const colorNames = [
  'background',
  'surface',
  'surface-muted',
  'border',
  'fg',
  'fg-muted',
  'primary',
  'on-primary',
  'primary-soft',
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
  'inverse',
  'on-inverse',
  'scrim',
];

const colors = Object.fromEntries(
  colorNames.map((name) => [name, `rgb(var(--color-${name}) / <alpha-value>)`]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      // Custom fonts on Android need the exact registered name per weight, so use these
      // instead of font-bold etc. Names match fontFamilies in tokens.ts.
      fontFamily: {
        heading: ['Nunito_700Bold'],
        'heading-black': ['Nunito_800ExtraBold'],
        body: ['Inter_400Regular'],
        'body-medium': ['Inter_500Medium'],
        'body-semibold': ['Inter_600SemiBold'],
      },
      fontSize: {
        display: ['32px', '40px'],
        title: ['24px', '32px'],
        heading: ['20px', '28px'],
        subheading: ['17px', '24px'],
        body: ['16px', '24px'],
        small: ['14px', '20px'],
        caption: ['12px', '16px'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
    },
  },
  plugins: [],
};
