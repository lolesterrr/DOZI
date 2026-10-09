import { Redirect, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, IconButton, Text } from '@/components/ui';
import { useProfile } from '@/features/profile/hooks';
import { strings } from '@/i18n/strings';
import { newId } from '@/lib/ids';
import { currentStudyDay } from '@/lib/time';

const s = strings.devDatabase;

// Developer-only check that the local database works (task 0.6). Release builds redirect home.
export default function DevDatabaseScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DatabaseCheck />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text selectable>{value}</Text>
    </View>
  );
}

// Throws while rendering, so the developer can see the app-wide error screen.
function Crash(): never {
  throw new Error('Test crash from the dev screen');
}

function DatabaseCheck() {
  const { profile, error } = useProfile();
  const [crash, setCrash] = useState(false);
  const sampleId = useMemo(() => newId(), []);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-row items-center gap-2 border-b border-border px-2 py-1">
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={strings.common.close}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <Text variant="heading">{s.title}</Text>
      </View>
      <ScrollView contentContainerClassName="gap-4 p-5">
        <Card className="gap-3">
          <Text variant="subheading" tone="primary">
            {s.profile}
          </Text>
          {profile ? (
            <>
              <Row label={s.profileId} value={profile.id} />
              <Row label={s.createdAt} value={profile.createdAt} />
              <Row label={s.timezone} value={profile.timezone} />
              <Row label={s.studyDay} value={currentStudyDay(profile.timezone)} />
              <Row label={s.dailyGoal} value={String(profile.dailyGoalXp)} />
            </>
          ) : (
            <Text tone="muted">{error ? error.message : s.noProfile}</Text>
          )}
        </Card>
        <Text tone="muted">{s.persistHint}</Text>
        <Card className="gap-3">
          <Text variant="subheading" tone="primary">
            {s.utilities}
          </Text>
          <Row label={s.newId} value={sampleId} />
          <Button label={s.crashTest} variant="outline" onPress={() => setCrash(true)} />
          {crash ? <Crash /> : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
