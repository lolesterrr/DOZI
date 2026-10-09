import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Button, Input } from '@/components/ui';
import { strings } from '@/i18n/strings';

import { FOLDER_NAME_MAX, TAG_NAME_MAX, type NameProblem } from '../logic';

const s = strings.library;

/** Turns a name problem into a friendly message. */
export function nameProblemMessage(problem: NameProblem, kind: 'folder' | 'tag'): string {
  switch (problem) {
    case 'empty':
      return s.nameProblems.empty;
    case 'tooLong':
      return s.nameProblems.tooLong(kind === 'folder' ? FOLDER_NAME_MAX : TAG_NAME_MAX);
    case 'duplicate':
      return kind === 'folder' ? s.nameProblems.duplicateFolder : s.nameProblems.duplicateTag;
  }
}

export type NameFormProps = {
  initialName?: string;
  placeholder?: string;
  submitLabel: string;
  /** Returns an error message, or null when the name is fine. */
  validate: (name: string) => string | null;
  onSubmit: (name: string) => void | Promise<void>;
  onCancel: () => void;
  /** Extra fields under the name (e.g. tag colours). */
  children?: ReactNode;
};

/** A name field with Save/Cancel. Shows the problem only after the first try. */
export function NameForm({
  initialName = '',
  placeholder,
  submitLabel,
  validate,
  onSubmit,
  onCancel,
  children,
}: NameFormProps) {
  const [name, setName] = useState(initialName);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const error = tried ? validate(name) : null;

  const submit = async () => {
    setTried(true);
    if (validate(name) || saving) return;
    setSaving(true);
    try {
      await onSubmit(name);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="gap-4 pb-2">
      <Input
        label={s.nameLabel}
        value={name}
        onChangeText={setName}
        placeholder={placeholder}
        error={error ?? undefined}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />
      {children}
      <View className="flex-row justify-end gap-3">
        <Button label={s.cancel} variant="ghost" onPress={onCancel} />
        <Button label={submitLabel} onPress={() => void submit()} loading={saving} />
      </View>
    </View>
  );
}
