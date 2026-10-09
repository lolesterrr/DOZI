// Import each weight from its own sub-path so only these five font files are bundled
// (importing from the package root would ship every weight, several MB of fonts).
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';

// Bundled with the app (no network needed). Loaded once in app/_layout.tsx via expo-font.
// Nunito for headings, Inter for body text. Keys must match fontFamilies in tokens.ts.
export const appFonts = {
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
};
