// The app's own settings (PRODUCT_SPEC §12, task 2.9), kept as one JSON value under the
// `app_settings` key. Parsing is forgiving: a missing or damaged field falls back to its default.
// Daily goal, reminder time and exam date live on the profile instead (onboarding sets them too).

export const APP_SETTINGS_KEY = 'app_settings';

export const themePreferences = ['system', 'light', 'dark'] as const;
export type ThemeSetting = (typeof themePreferences)[number];

/** `system` follows the phone's text size; the others make everything a bit bigger on top of it. */
export const textSizes = ['system', 'large', 'larger'] as const;
export type TextSize = (typeof textSizes)[number];

export const textScaleFor: Record<TextSize, number> = { system: 1, large: 1.15, larger: 1.3 };

export type NotificationToggles = {
  /** The daily reminder at the chosen time (when the goal isn't met yet). */
  daily: boolean;
  /** The streak nudge in the evening. */
  streak: boolean;
  /** The exam countdown (7, 3 and 1 days before). */
  exam: boolean;
};

export type AppSettings = {
  theme: ThemeSetting;
  textSize: TextSize;
  notifications: NotificationToggles;
  /** Data saver: media sync and downloads on Wi-Fi only (used from Phase 3). */
  wifiOnly: boolean;
};

export const defaultSettings: AppSettings = {
  theme: 'system',
  textSize: 'system',
  notifications: { daily: true, streak: true, exam: true },
  wifiOnly: true,
};

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Reads a saved value (anything) into settings, using defaults for whatever is missing. */
export function parseAppSettings(value: unknown): AppSettings {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const n = (
    raw.notifications && typeof raw.notifications === 'object' ? raw.notifications : {}
  ) as Record<string, unknown>;
  return {
    theme: pick(raw.theme, themePreferences, defaultSettings.theme),
    textSize: pick(raw.textSize, textSizes, defaultSettings.textSize),
    notifications: {
      daily: bool(n.daily, defaultSettings.notifications.daily),
      streak: bool(n.streak, defaultSettings.notifications.streak),
      exam: bool(n.exam, defaultSettings.notifications.exam),
    },
    wifiOnly: bool(raw.wifiOnly, defaultSettings.wifiOnly),
  };
}

export type AppSettingsChanges = Partial<Omit<AppSettings, 'notifications'>> & {
  notifications?: Partial<NotificationToggles>;
};

/** Applies a change to the settings (notification toggles are merged one by one). */
export function mergeAppSettings(current: AppSettings, changes: AppSettingsChanges): AppSettings {
  return parseAppSettings({
    ...current,
    ...changes,
    notifications: { ...current.notifications, ...changes.notifications },
  });
}
