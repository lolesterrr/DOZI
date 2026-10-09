import { strings } from '@/i18n/strings';
import type { ColorName, Palette } from '@/theme';

import { calloutKinds, type CalloutKind } from '../callouts';

// The note editor's look inside the WebView, built from the app's theme tokens so it follows
// light/dark mode. Highlights are saved by colour *name* and drawn with the matching
// soft/on-soft token pair, which the theme tests already check for AA contrast.

/** Highlight colours offered in the toolbar, saved in the note as these names. */
export const highlightColours = ['accent', 'success', 'danger', 'primary'] as const;
export type HighlightColour = (typeof highlightColours)[number];

const softPair = (name: HighlightColour): [ColorName, ColorName] => [
  `${name}-soft` as ColorName,
  `on-${name}-soft` as ColorName,
];

/** Each callout's colours, by theme name; the label (not colour alone) says which kind it is. */
export const calloutColours: Record<CalloutKind, HighlightColour> = {
  examTip: 'accent',
  mnemonic: 'primary',
  warning: 'danger',
  clinicalPearl: 'success',
};

/** A string as a CSS `content` value (quotes and backslashes dropped: TenTap injects the CSS raw). */
const cssString = (value: string) => `"${value.replace(/["\\`]/g, '')}"`;

/** CSS for the editor in one colour scheme. Must not contain backticks (TenTap injects it). */
export function editorCss(colors: Palette): string {
  const marks = highlightColours
    .map((name) => {
      const [bg, fg] = softPair(name);
      return `mark[data-color="${name}"] { background-color: ${colors[bg]} !important; color: ${colors[fg]} !important; }`;
    })
    .join('\n');
  const callouts = calloutKinds
    .map((kind) => {
      const [bg, fg] = softPair(calloutColours[kind]);
      return `.callout[data-callout="${kind}"] { background-color: ${colors[bg]}; color: ${colors[fg]}; border-left-color: ${colors[fg]}; }
    .callout[data-callout="${kind}"]::before { content: ${cssString(strings.notes.callouts[kind])}; }`;
    })
    .join('\n');
  return `
    html, body, #root, .ProseMirror { background-color: ${colors.background}; color: ${colors.fg}; }
    .ProseMirror { caret-color: ${colors.primary}; }
    h1, h2, h3 { line-height: 1.25; margin: 0.9em 0 0.4em; }
    h1 { font-size: 1.6em; } h2 { font-size: 1.3em; } h3 { font-size: 1.1em; }
    p { margin: 0.4em 0; }
    a { color: ${colors.primary}; }
    mark { border-radius: 3px; padding: 0 2px; }
    ${marks}
    ${callouts}
    blockquote { border-left: 3px solid ${colors.primary}; margin: 0.6em 0; padding-left: 1em;
      color: ${colors['fg-muted']}; }
    code { background-color: ${colors['surface-muted']}; border-radius: 4px; padding: 0 3px; }
    hr { border-top-color: ${colors.border}; }
    hr.ProseMirror-selectednode, img.ProseMirror-selectednode { outline-color: ${colors.primary}; }
    td, th { border-color: ${colors.border}; }
    th { background-color: ${colors['surface-muted']}; }
    .selectedCell:after { background-color: ${colors['primary-soft']}; }
    ul[data-type="taskList"] li > label > input { accent-color: ${colors.primary};
      width: 1.1em; height: 1.1em; margin: 0.25em 0 0; }
    .is-editor-empty:first-child::before { color: ${colors['fg-muted']}; }
  `;
}
