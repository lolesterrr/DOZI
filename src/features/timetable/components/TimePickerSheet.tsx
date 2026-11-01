import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { BottomSheet, Button, Chip, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';

const s = strings.timetable;

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06 … 22
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, '0');

/** Picks a time of day: big readout, then an hour and a minute (5-minute steps). */
export function TimePickerSheet({
  visible,
  title,
  value,
  onClose,
  onDone,
  children,
}: {
  visible: boolean;
  title: string;
  /** "HH:mm" */
  value: string;
  onClose: () => void;
  onDone: (time: string) => void;
  /** Extra choices above the hours (e.g. "on the day" / "the day before"). */
  children?: ReactNode;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      {/* Mounted only while open, so it starts from `value` each time. */}
      {visible ? (
        <Picker value={value} onDone={onDone}>
          {children}
        </Picker>
      ) : null}
    </BottomSheet>
  );
}

function Picker({
  value,
  onDone,
  children,
}: {
  value: string;
  onDone: (time: string) => void;
  children?: ReactNode;
}) {
  const [hour, setHour] = useState(Number(value.slice(0, 2)));
  const [minute, setMinute] = useState(Math.floor(Number(value.slice(3, 5)) / 5) * 5);
  const time = `${pad(hour)}:${pad(minute)}`;
  return (
    <ScrollView style={{ maxHeight: 520 }} contentContainerClassName="gap-4 pb-2">
      <View
        className="items-center rounded-lg bg-primary-soft py-3"
        accessibilityLiveRegion="polite"
      >
        <Text variant="display" tone="inherit" className="text-on-primary-soft">
          {time}
        </Text>
      </View>
      {children}
      <View className="gap-2">
        <Text variant="label">{s.hour}</Text>
        <View className="flex-row flex-wrap gap-2">
          {HOURS.map((h) => (
            <Chip
              key={h}
              label={pad(h)}
              selected={h === hour}
              onPress={() => setHour(h)}
              className="min-w-[56px] justify-center"
            />
          ))}
        </View>
      </View>
      <View className="gap-2">
        <Text variant="label">{s.minute}</Text>
        <View className="flex-row flex-wrap gap-2">
          {MINUTES.map((m) => (
            <Chip
              key={m}
              label={`:${pad(m)}`}
              selected={m === minute}
              onPress={() => setMinute(m)}
              className="min-w-[56px] justify-center"
            />
          ))}
        </View>
      </View>
      <Button label={s.done} onPress={() => onDone(time)} />
    </ScrollView>
  );
}
