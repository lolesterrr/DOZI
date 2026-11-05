import { CloudCheck, CloudOff, CloudAlert, RefreshCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { requestSync } from '../controller';
import { useSyncStatus } from '../hooks';
import { timeAgo } from '../logic';

const s = strings.account.sync;

/** Account screen: is the student's study backed up, and a "Back up now" button (task 3.3). */
export function SyncStatusCard() {
  const { colors } = useTheme();
  const status = useSyncStatus();
  // "5 minutes ago" moves on by itself.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  // A run that finished after the last tick is "just now", never "in the future".
  const shownNow = status.lastSyncedAt ? Math.max(now, Date.parse(status.lastSyncedAt)) : now;

  let Icon = CloudCheck;
  let tone = colors.success;
  let message: string;
  if (status.phase === 'syncing') {
    Icon = RefreshCw;
    tone = colors.primary;
    message = s.syncing;
  } else if (status.phase === 'offline') {
    Icon = CloudOff;
    tone = colors['fg-muted'];
    message = s.offline;
  } else if (status.phase === 'error') {
    Icon = CloudAlert;
    tone = colors.danger;
    message = s.error;
  } else if (status.lastSyncedAt) {
    message = s.lastSynced(timeAgo(status.lastSyncedAt, shownNow, s));
  } else {
    Icon = CloudOff;
    tone = colors['fg-muted'];
    message = s.never;
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3" accessible accessibilityLiveRegion="polite">
        <Icon color={tone} size={26} />
        <View className="flex-1">
          <Text variant="bodyStrong">{s.title}</Text>
          <Text variant="small" tone="muted">
            {message}
          </Text>
        </View>
      </View>
      <Button
        label={s.now}
        variant="outline"
        icon={RefreshCw}
        loading={status.phase === 'syncing'}
        disabled={status.phase === 'syncing'}
        onPress={() => requestSync()}
      />
    </Card>
  );
}
