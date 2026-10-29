import { defaultSettings, mergeAppSettings, parseAppSettings, textScaleFor } from '../logic';

describe('parseAppSettings', () => {
  it('gives the defaults for nothing or junk', () => {
    expect(parseAppSettings(undefined)).toEqual(defaultSettings);
    expect(parseAppSettings('dark')).toEqual(defaultSettings);
    expect(parseAppSettings(null)).toEqual(defaultSettings);
  });

  it('keeps valid fields and repairs invalid ones one by one', () => {
    const parsed = parseAppSettings({
      theme: 'dark',
      textSize: 'huge',
      notifications: { daily: false, streak: 'yes' },
      wifiOnly: false,
    });
    expect(parsed.theme).toBe('dark');
    expect(parsed.textSize).toBe('system');
    expect(parsed.notifications).toEqual({ daily: false, streak: true, exam: true });
    expect(parsed.wifiOnly).toBe(false);
  });
});

describe('mergeAppSettings', () => {
  it('changes one notification toggle and keeps the others', () => {
    const next = mergeAppSettings(defaultSettings, { notifications: { streak: false } });
    expect(next.notifications).toEqual({ daily: true, streak: false, exam: true });
    expect(next.theme).toBe('system');
  });

  it('ignores a value that isn’t allowed', () => {
    const next = mergeAppSettings(defaultSettings, { theme: 'purple' as never });
    expect(next.theme).toBe('system');
  });
});

describe('textScaleFor', () => {
  it('only enlarges, never shrinks', () => {
    expect(textScaleFor.system).toBe(1);
    expect(textScaleFor.large).toBeGreaterThan(1);
    expect(textScaleFor.larger).toBeGreaterThan(textScaleFor.large);
  });
});
