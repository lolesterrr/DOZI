import * as Haptics from 'expo-haptics';

import { createLogger } from '@/lib/logger';

const log = createLogger('haptics');

/** tap: a light touch · success / warning: short patterns · celebrate: the big moments. */
export type HapticKind = 'tap' | 'success' | 'warning' | 'celebrate';

/**
 * A short vibration for feedback (task 2.5). It never throws and never waits: a phone without a
 * vibration motor, or one that has it switched off, simply does nothing.
 */
export function haptic(kind: HapticKind): void {
  const run = async () => {
    if (kind === 'tap') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (kind === 'success')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'warning')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };
  run().catch((error: unknown) => log.debug('Haptic failed', { error: String(error) }));
}
