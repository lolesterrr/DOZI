import { useTheme } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { strings } from '@/i18n/strings';

// Placeholder home screen for task 0.1. The real tabs arrive in task 0.5.
export default function HomeScreen() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.text }]}>{strings.home.greeting}</Text>
        <Text style={[styles.tagline, { color: colors.text }]}>{strings.home.tagline}</Text>
      </View>
      <Text style={[styles.disclaimer, { color: colors.text }]}>{strings.disclaimer}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 32, fontWeight: '700' },
  tagline: { fontSize: 16, opacity: 0.8, textAlign: 'center' },
  disclaimer: { fontSize: 12, opacity: 0.6, textAlign: 'center' },
});
