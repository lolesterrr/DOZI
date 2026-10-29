import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

import type { PlannedNotification } from './logic';

const log = createLogger('notifications');

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/** What the planner needs from the phone. Tests pass a fake. */
export type NotificationPort = {
  cancelAll: () => Promise<void>;
  schedule: (notification: PlannedNotification) => Promise<void>;
};

const CHANNEL_ID = 'study-reminders';

export const devicePort: NotificationPort = {
  cancelAll: () => Notifications.cancelAllScheduledNotificationsAsync(),
  async schedule(n) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(n.at),
        channelId: CHANNEL_ID,
      },
    });
  },
};

/**
 * Replaces everything scheduled with `plan`. Safe to call often: the plan is cheap and the whole
 * set is swapped, so a stale notification can never be left behind.
 */
export async function applyPlan(
  plan: readonly PlannedNotification[],
  port: NotificationPort = devicePort,
): Promise<void> {
  await port.cancelAll();
  for (const notification of plan) {
    try {
      await port.schedule(notification);
    } catch (error) {
      log.warn('Could not schedule a notification', { id: notification.id, error: String(error) });
    }
  }
}

export async function getPermissionState(): Promise<PermissionState> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.DENIED && !canAskAgain) return 'denied';
  return status === Notifications.PermissionStatus.DENIED ? 'denied' : 'undetermined';
}

/** Shows the system permission prompt (once; later it just reports the answer). */
export async function requestPermission(): Promise<PermissionState> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: strings.notifications.channelName,
        importance: AndroidImportance.DEFAULT,
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    return status === Notifications.PermissionStatus.GRANTED ? 'granted' : 'denied';
  } catch (error) {
    log.warn('Could not ask for notification permission', { error: String(error) });
    return 'denied';
  }
}
