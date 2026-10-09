import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

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

const headingVariants: TextVariant[] = ['display', 'title', 'heading'];

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  className?: string;
};

/** Themed text. Scales with the system font size (allowFontScaling stays on). */
export function Text({ variant = 'body', tone = 'default', className, ...props }: TextProps) {
  return (
    <RNText
      accessibilityRole={headingVariants.includes(variant) ? 'header' : undefined}
      className={cn(variantClasses[variant], toneClasses[tone], className)}
      {...props}
    />
  );
}
