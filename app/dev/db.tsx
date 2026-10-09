import { Redirect, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, IconButton, Text } from '@/components/ui';
import { useDatabase } from '@/db/DatabaseProvider';
import { addSampleNotes, removeSampleNotes, searchNotes } from '@/features/notes/repo';
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
        {profile ? <SearchSpeed ownerId={profile.id} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const SAMPLE_COUNT = 500;
/** A word the SAMPLE notes use (src/features/notes/sampleNotes.ts). */
const SPEED_TEST_WORD = 'seminar';

// Task 1.4's check: searching a word inside note bodies with 500 notes takes under 200 ms.
function SearchSpeed({ ownerId }: { ownerId: string }) {
  const db = useDatabase();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  const run = (work: () => Promise<string>) => {
    setBusy(true);
    work()
      .then(setResult)
      .catch((err: unknown) => setResult(String(err)))
      .finally(() => setBusy(false));
  };

  return (
    <Card className="gap-3">
      <Text variant="subheading" tone="primary">
        {s.searchSpeed}
      </Text>
      <Text tone="muted">{s.searchSpeedHint}</Text>
      <Button
        label={s.addSamples(SAMPLE_COUNT)}
        variant="outline"
        disabled={busy}
        onPress={() =>
          run(async () => {
            await addSampleNotes(db, ownerId, SAMPLE_COUNT);
            return s.samplesAdded(SAMPLE_COUNT);
          })
        }
      />
      <Button
        label={s.timeSearch(SPEED_TEST_WORD)}
        disabled={busy}
        onPress={() =>
          run(async () => {
            const started = performance.now();
            const found = await searchNotes(db, ownerId, SPEED_TEST_WORD);
            return s.searchTimed(found.length, Math.round(performance.now() - started));
          })
        }
      />
      <Button
        label={s.removeSamples}
        variant="outline"
        disabled={busy}
        onPress={() => run(async () => s.samplesRemoved(await removeSampleNotes(db, ownerId)))}
      />
      {result !== '' ? (
        <Text accessibilityLiveRegion="polite" selectable>
          {result}
        </Text>
      ) : null}
    </Card>
  );
}
