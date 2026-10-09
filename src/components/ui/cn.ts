/** Joins class names, skipping falsy values: cn('p-4', isOn && 'bg-primary'). */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
