// Import each weight from its own sub-path so only these four font files are bundled
// (importing from the package root would ship every weight, several MB of fonts).
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';

// Bundled with the app (no network needed). Loaded once in app/_layout.tsx via expo-font.
// Poppins for everything (doodle look). Keys must match fontFamilies in tokens.ts.
export const appFonts = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
};
