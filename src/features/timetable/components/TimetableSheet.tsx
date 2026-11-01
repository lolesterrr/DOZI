import { Check, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomSheet, Button, Input, Text, useToast } from '@/components/ui';
import type { Timetable } from '@/db/schema';
import { SheetAction } from '@/features/library/components/SheetAction';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme';

import { useTimetableActions } from '../hooks';
import { cleanName } from '../repo';

const s = strings.timetable;
const log = createLogger('timetable');

type Step = 'list' | 'new' | 'rename' | 'delete';

/** Switch between timetables, make a new one, rename or delete the one in use. */
export function TimetableSheet({
  visible,
  onClose,
  timetables,
  active,
}: {
  visible: boolean;
  onClose: () => void;
  timetables: readonly Timetable[];
  active: Timetable | undefined;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const actions = useTimetableActions();
  const [step, setStep] = useState<Step>('list');
  const [name, setName] = useState('');

  const close = () => {
    setStep('list');
    onClose();
  };
  const run = (work: () => Promise<unknown>) =>
    work()
      .then(close)
      .catch((error: unknown) => {
        log.warn('Timetable change failed', { error: String(error) });
        toast.show({ message: s.failed, tone: 'error' });
      });

  const title =
    step === 'new'
      ? s.newTimetable
      : step === 'rename'
        ? s.renameTitle
        : step === 'delete'
          ? s.deleteTimetable
          : s.manageTitle;

  return (
    <BottomSheet visible={visible} onClose={close} title={title}>
      {step === 'list' ? (
        <View className="gap-1 pb-2">
          <Text variant="small" tone="muted" className="pb-2">
            {s.manageHelp}
          </Text>
          {timetables.map((t) => {
            const inUse = t.id === active?.id;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: inUse }}
                accessibilityLabel={inUse ? `${t.name}, ${s.inUse}` : s.useThis(t.name)}
                onPress={() => run(() => actions.setActive(t.id))}
                className="min-h-touch flex-row items-center gap-3 rounded-md px-2 py-3 active:bg-surface-muted"
              >
                <View
                  className={
                    inUse
                      ? 'h-6 w-6 items-center justify-center rounded-full bg-primary'
                      : 'h-6 w-6 rounded-full border-2 border-border'
                  }
                >
                  {inUse ? <Check color={colors['on-primary']} size={16} /> : null}
                </View>
                <Text variant="bodyStrong" className="flex-1">
                  {t.name}
                </Text>
                {inUse ? (
                  <Text variant="caption" tone="primary">
                    {s.inUse}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
          <View className="my-2 h-px bg-border" />
          <SheetAction
            icon={Plus}
            label={s.newTimetable}
            onPress={() => {
              setName('');
              setStep('new');
            }}
          />
          {active ? (
            <>
              <SheetAction
                icon={Pencil}
                label={s.rename}
                onPress={() => {
                  setName(active.name);
                  setStep('rename');
                }}
              />
              <SheetAction
                icon={Trash2}
                label={s.deleteTimetable}
                danger
                onPress={() => setStep('delete')}
              />
            </>
          ) : null}
        </View>
      ) : step === 'delete' && active ? (
        <View className="gap-3 pb-2">
          <Text>{s.deleteTimetableConfirm(active.name)}</Text>
          <Button
            label={s.deleteConfirm}
            variant="danger"
            icon={Trash2}
            onPress={() => run(() => actions.deleteTimetable(active.id))}
          />
          <Button label={s.cancel} variant="ghost" onPress={() => setStep('list')} />
        </View>
      ) : (
        <View className="gap-3 pb-2">
          <Input
            label={s.newTimetableName}
            placeholder={s.newTimetablePlaceholder}
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={60}
          />
          <Button
            label={step === 'new' ? s.create : s.save}
            disabled={!cleanName(name)}
            onPress={() =>
              run(() =>
                step === 'new'
                  ? actions.createTimetable(name)
                  : actions.renameTimetable(active?.id ?? '', name),
              )
            }
          />
          <Button label={s.cancel} variant="ghost" onPress={() => setStep('list')} />
        </View>
      )}
    </BottomSheet>
  );
}
