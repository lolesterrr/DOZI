import { format, parseISO } from 'date-fns';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Bell, BellOff, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, View } from 'react-native';

import { Button, Card, Chip, Text, useToast } from '@/components/ui';
import { goalChoices, reminderTimes } from '@/features/onboarding/logic';
import { useNotificationPermission } from '@/features/notifications';
import { useProfile } from '@/features/profile/hooks';
import { formatBytes } from '@/features/media/logic';
import { useCleanUpNow, useStorageUsed } from '@/features/media/hooks';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme';

import { useAppSettings, useProfileSettings } from '../hooks';
import { textSizes, themePreferences, type AppSettingsChanges } from '../logic';

const s = strings.settings;
const log = createLogger('settings');

/** Settings (PRODUCT_SPEC §12): appearance, studying, reminders, data and storage, about. */
export function SettingsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const { profile } = useProfile();
  const { settings, update } = useAppSettings();
  const { setDailyGoal, setReminderTime } = useProfileSettings();
  const permission = useNotificationPermission();
  const storage = useStorageUsed();
  const cleanUp = useCleanUpNow();
  const [clearing, setClearing] = useState(false);

  const save = (work: () => Promise<void>) =>
    work().catch((error: unknown) => {
      log.warn('Could not save a setting', { error: String(error) });
      toast.show({ message: s.saveFailed, tone: 'error' });
    });
  const change = (changes: AppSettingsChanges) => void save(() => update(changes));

  const clear = async () => {
    setClearing(true);
    try {
      const count = await cleanUp();
      toast.show({ message: count === 0 ? s.clearedNone : s.cleared(count), tone: 'success' });
    } catch (error) {
      log.warn('Clearing files failed', { error: String(error) });
      toast.show({ message: s.clearFailed, tone: 'error' });
    } finally {
      setClearing(false);
    }
  };

  const toggles = settings.notifications;
  const examDate = profile?.examDate ? format(parseISO(profile.examDate), 'd MMM yyyy') : null;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4 pb-10">
      <Card className="gap-4">
        <Text variant="heading">{s.appearance}</Text>
        <Group label={s.theme}>
          {themePreferences.map((theme) => (
            <Chip
              key={theme}
              label={s.themes[theme]}
              selected={settings.theme === theme}
              onPress={() => change({ theme })}
            />
          ))}
        </Group>
        <Group label={s.textSize} help={s.textSizeHelp}>
          {textSizes.map((size) => (
            <Chip
              key={size}
              label={s.textSizes[size]}
              selected={settings.textSize === size}
              onPress={() => change({ textSize: size })}
            />
          ))}
        </Group>
      </Card>

      <Card className="gap-4">
        <Text variant="heading">{s.study}</Text>
        <Group label={s.dailyGoal} help={s.dailyGoalHelp}>
          {goalChoices.map((goal) => (
            <Chip
              key={goal.key}
              label={`${strings.onboarding.goals[goal.key].name} · ${goal.xp}`}
              selected={profile?.dailyGoalXp === goal.xp}
              onPress={() => void save(() => setDailyGoal(goal.xp))}
            />
          ))}
        </Group>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.changeSetup}
          onPress={() => router.push({ pathname: '/onboarding', params: { mode: 'edit' } })}
          className="min-h-touch flex-row items-center gap-3 active:opacity-70"
        >
          <View className="flex-1">
            <Text variant="bodyStrong">{s.changeSetup}</Text>
            <Text variant="small" tone="muted">
              {s.examDate(examDate)}
            </Text>
          </View>
          <ChevronRight color={colors['fg-muted']} size={20} />
        </Pressable>
      </Card>

      <Card className="gap-4">
        <Text variant="heading">{s.reminders}</Text>
        <Text variant="small" tone="muted">
          {s.remindersHelp}
        </Text>
        {permission.state !== null && permission.state !== 'granted' ? (
          <View className="gap-3 rounded-lg bg-surface-muted p-3">
            <View className="flex-row items-center gap-2">
              <BellOff color={colors['fg-muted']} size={20} />
              <Text variant="bodyStrong">{s.allowTitle}</Text>
            </View>
            <Text variant="small" tone="muted">
              {permission.state === 'denied' ? s.blockedMessage : s.allowMessage}
            </Text>
            {permission.state === 'denied' ? (
              <Button
                label={s.openPhoneSettings}
                variant="outline"
                onPress={() => void Linking.openSettings()}
              />
            ) : (
              <Button label={s.allow} icon={Bell} onPress={() => void permission.ask()} />
            )}
          </View>
        ) : null}
        <ToggleRow
          label={s.toggleDaily}
          help={s.toggleDailyHelp}
          value={toggles.daily}
          onChange={(daily) => change({ notifications: { daily } })}
        />
        {toggles.daily ? (
          <Group label={s.reminderTime}>
            {reminderTimes().map((time) => (
              <Chip
                key={time}
                label={time}
                selected={profile?.reminderTime === time}
                onPress={() => void save(() => setReminderTime(time))}
              />
            ))}
          </Group>
        ) : null}
        <ToggleRow
          label={s.toggleStreak}
          help={s.toggleStreakHelp}
          value={toggles.streak}
          onChange={(streak) => change({ notifications: { streak } })}
        />
        <ToggleRow
          label={s.toggleExam}
          help={s.toggleExamHelp}
          value={toggles.exam}
          onChange={(exam) => change({ notifications: { exam } })}
        />
      </Card>

      <Card className="gap-4">
        <Text variant="heading">{s.data}</Text>
        <ToggleRow
          label={s.dataSaver}
          help={s.dataSaverHelp}
          value={settings.wifiOnly}
          onChange={(wifiOnly) => change({ wifiOnly })}
        />
        <View className="gap-2">
          <Text variant="bodyStrong">{s.storageUsed}</Text>
          <Text tone="muted">{formatBytes(storage)}</Text>
          <Button
            label={s.clearCaches}
            variant="outline"
            loading={clearing}
            onPress={() => void clear()}
          />
        </View>
      </Card>

      <Card className="gap-2">
        <Text variant="heading">{s.about}</Text>
        <Text variant="small" tone="muted">
          {s.version(Constants.expoConfig?.version ?? '1.0.0')}
        </Text>
        <Text variant="small" tone="muted">
          {s.aboutNote}
        </Text>
        <Text variant="small" tone="muted">
          {strings.disclaimer}
        </Text>
      </Card>
    </ScrollView>
  );
}

function Group({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text variant="bodyStrong">{label}</Text>
      {help ? (
        <Text variant="small" tone="muted">
          {help}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

function ToggleRow({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="min-h-touch flex-row items-center gap-3">
      <View className="flex-1">
        <Text variant="bodyStrong">{label}</Text>
        <Text variant="small" tone="muted">
          {help}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}
