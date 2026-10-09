// Callout blocks in notes (PRODUCT_SPEC §4.1). Kept apart from logic.ts, with no imports, because
// the editor's WebView bundle uses it too (bridges.ts) and should stay small.

/** The callout blocks a note can hold, saved in the note by these names. */
export const calloutKinds = ['examTip', 'mnemonic', 'warning', 'clinicalPearl'] as const;
export type CalloutKind = (typeof calloutKinds)[number];

export function isCalloutKind(value: unknown): value is CalloutKind {
  return typeof value === 'string' && (calloutKinds as readonly string[]).includes(value);
}
