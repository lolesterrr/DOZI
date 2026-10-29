import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { typeScale, useTextScale } from '@/theme';

import { cn } from './cn';

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'caption'
  | 'label';

export type TextTone =
  'default' | 'muted' | 'primary' | 'success' | 'danger' | 'onPrimary' | 'inherit';

const variantClasses: Record<TextVariant, string> = {
  display: 'font-heading-black text-display',
  title: 'font-heading text-title',
  heading: 'font-heading text-heading',
  subheading: 'font-body-semibold text-subheading',
  body: 'font-body text-body',
  bodyStrong: 'font-body-semibold text-body',
  small: 'font-body text-small',
  caption: 'font-body text-caption',
  label: 'font-body-medium text-small',
};

const toneClasses: Record<TextTone, string> = {
  default: 'text-fg',
  muted: 'text-fg-muted',
  primary: 'text-primary',
  success: 'text-success',
  danger: 'text-danger',
  onPrimary: 'text-on-primary',
  inherit: '',
};

// Which size in the type scale each variant uses (see variantClasses).
const sizeKey: Record<TextVariant, keyof typeof typeScale> = {
  display: 'display',
  title: 'title',
  heading: 'heading',
  subheading: 'subheading',
  body: 'body',
  bodyStrong: 'body',
  small: 'small',
  caption: 'caption',
  label: 'small',
};

const headingVariants: TextVariant[] = ['display', 'title', 'heading'];

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  className?: string;
};

/** Themed text. Scales with the system font size (allowFontScaling stays on). */
export function Text({
  variant = 'body',
  tone = 'default',
  className,
  style,
  ...props
}: TextProps) {
  const textScale = useTextScale();
  // The "Text size" setting (task 2.9) enlarges everything a step on top of the phone's size.
  const size = typeScale[sizeKey[variant]];
  const scaled =
    textScale === 1
      ? undefined
      : {
          fontSize: Math.round(size.fontSize * textScale),
          lineHeight: Math.round(size.lineHeight * textScale),
        };
  return (
    <RNText
      accessibilityRole={headingVariants.includes(variant) ? 'header' : undefined}
      className={cn(variantClasses[variant], toneClasses[tone], className)}
      style={scaled ? [scaled, style] : style}
      {...props}
    />
  );
}
