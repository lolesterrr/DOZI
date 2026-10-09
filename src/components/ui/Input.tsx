import { CircleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

import { cn } from './cn';
import { Text } from './Text';

export type InputProps = TextInputProps & {
  label: string;
  hint?: string;
  /** Shown with an icon, not only in red (never colour alone). */
  error?: string;
  className?: string;
};

/** Labelled single-line text field. For long text use TextArea. */
export function Input({
  label,
  hint,
  error,
  multiline,
  className,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View className="gap-1.5">
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors['fg-muted']}
        selectionColor={colors.primary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={cn(
          'min-h-touch rounded-md border bg-surface px-3.5 py-2.5 font-body text-body text-fg',
          error ? 'border-danger' : focused ? 'border-primary' : 'border-border',
          focused && 'border-2',
          className,
        )}
        {...props}
      />
      {error ? (
        <View className="flex-row items-center gap-1.5">
          <CircleAlert color={colors.danger} size={16} />
          <Text variant="small" tone="danger" className="flex-1">
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export type TextAreaProps = Omit<InputProps, 'multiline'> & { minLines?: number };

/** Multi-line text field that grows with its content. */
export function TextArea({ minLines = 4, className, ...props }: TextAreaProps) {
  // 24 dp line height (text-body) + vertical padding.
  return (
    <Input
      multiline
      style={{ minHeight: minLines * 24 + 20 }}
      className={cn('py-2.5', className)}
      {...props}
    />
  );
}
