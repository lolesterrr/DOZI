import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

import type { PlannedNotification, WeeklyNotification } from './logic';

const log = createLogger('notifications');

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/** What the planner needs from the phone. Tests pass a fake. */
export type NotificationPort = {
  cancelAll: () => Promise<void>;
  schedule: (notification: PlannedNotification) => Promise<void>;
  scheduleWeekly: (notification: WeeklyNotification) => Promise<void>;
};

const CHANNEL_ID = 'study-reminders';
const LECTURE_CHANNEL_ID = 'lecture-reminders';

/** Our weekdays are 1 = Monday … 7 = Sunday; the phone's are 1 = Sunday … 7 = Saturday. */
export function phoneWeekday(weekday: number): number {
  return (weekday % 7) + 1;
}

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
  async scheduleWeekly(n) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: phoneWeekday(n.weekday),
        hour: Number(n.time.slice(0, 2)),
        minute: Number(n.time.slice(3, 5)),
        channelId: LECTURE_CHANNEL_ID,
      },
    });
  },
};

/**
 * Replaces everything scheduled with `plan` (one-off study reminders) and `weekly` (lecture
 * reminders that repeat each week). Safe to call often: the plan is cheap and the whole set is
 * swapped, so a stale notification can never be left behind.
 */
export async function applyPlan(
  plan: readonly PlannedNotification[],
  weekly: readonly WeeklyNotification[] = [],
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
  for (const notification of weekly) {
    try {
      await port.scheduleWeekly(notification);
    } catch (error) {
      log.warn('Could not schedule a lecture reminder', {
        id: notification.id,
        error: String(error),
      });
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
      await Notifications.setNotificationChannelAsync(LECTURE_CHANNEL_ID, {
        name: strings.notifications.lectureChannelName,
        importance: AndroidImportance.HIGH,
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    return status === Notifications.PermissionStatus.GRANTED ? 'granted' : 'denied';
  } catch (error) {
    log.warn('Could not ask for notification permission', { error: String(error) });
    return 'denied';
  }
}
