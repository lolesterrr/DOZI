import { palettes } from '@/theme';

import { Schema } from '@tiptap/pm/model';
import { EditorState, NodeSelection, TextSelection } from '@tiptap/pm/state';

import {
  CONTENT_MESSAGE,
  createContentSyncBridge,
  noteEditorBridges,
  noteSelectionOf,
} from '../bridges';
import { strings } from '@/i18n/strings';

import { calloutKinds } from '../../callouts';
import { editorCss, highlightColours } from '../css';
import { editorHtml } from '../editorHtml';

describe('note editor bridges', () => {
  const names = noteEditorBridges().map((bridge) => bridge.name);

  it('adds tables, the divider, media images and autosave to the starter kit', () => {
    expect(names).toEqual(
      expect.arrayContaining(['bold', 'heading', 'taskList', 'highlight', 'image', 'table']),
    );
    expect(names).toEqual(
      expect.arrayContaining(['horizontalRule', 'callout', 'doziSelection', 'doziContentSync']),
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it('is built into the WebView bundle (run `npm run editor:build` if this fails)', () => {
    for (const marker of [
      'dozi-table',
      'dozi-divider',
      'dozi-callout',
      'dozi-insert-image',
      'dozi-replace-image',
      'doziSelection',
      'noteSelection',
      CONTENT_MESSAGE,
    ]) {
      expect(editorHtml).toContain(marker);
    }
  });

  it('passes content messages from the WebView to the app', () => {
    const onContent = jest.fn();
    const bridge = createContentSyncBridge(onContent);
    const handled = bridge.onEditorMessage?.(
      { type: CONTENT_MESSAGE, payload: { type: 'doc' } },
      {} as never,
    );
    expect(handled).toBe(true);
    expect(onContent).toHaveBeenCalledWith({ type: 'doc' });
    expect(bridge.onEditorMessage?.({ type: 'other' } as never, {} as never)).toBe(false);
  });
});

describe('editor CSS', () => {
  it.each(['light', 'dark'] as const)('uses %s theme tokens for every highlight', (scheme) => {
    const css = editorCss(palettes[scheme]);
    // TenTap injects the CSS inside a JS template string.
    expect(css).not.toContain('`');
    for (const colour of highlightColours) {
      expect(css).toContain(`mark[data-color="${colour}"]`);
    }
    expect(css).toContain(palettes[scheme].background);
  });

  it.each(['light', 'dark'] as const)('labels and colours every callout (%s)', (scheme) => {
    const css = editorCss(palettes[scheme]);
    for (const kind of calloutKinds) {
      expect(css).toContain(
        `.callout[data-callout="${kind}"]::before { content: "${strings.notes.callouts[kind]}"; }`,
      );
    }
  });
});

describe('editor WebView origins', () => {
  // react-native-webview's own check, run the way the native side calls it.
  const { createOnShouldStartLoadWithRequest } = jest.requireActual(
    'react-native-webview/lib/WebViewShared',
  );
  const { EDITOR_ORIGINS } = jest.requireActual('../NoteEditor');

  const allows = (url: string) => {
    const load = jest.fn();
    createOnShouldStartLoadWithRequest(load, EDITOR_ORIGINS)({ nativeEvent: { url } });
    return load.mock.calls[0][0] as boolean;
  };

  it('lets the editor page load from the documents folder (iOS checks the file:// base URL)', () => {
    expect(allows('file:///var/mobile/Containers/Data/Application/X/Documents/')).toBe(true);
    expect(allows('about:blank')).toBe(true);
  });

  it('sends web links to the browser instead of loading them in the editor', () => {
    expect(allows('https://example.org/')).toBe(false);
  });
});

describe('selected text for "Make card"', () => {
  // A small schema: paragraphs of text and images (SAMPLE words only).
  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'text*' },
      image: { group: 'block', attrs: { src: { default: '' } } },
      text: {},
    },
  });
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text('One SAMPLE word here.')]),
    schema.node('image', { src: 'media://m1' }),
    schema.node('paragraph', null, [schema.text('Second line.')]),
  ]);
  // Positions: the first paragraph's text starts at 1.
  const at = (from: number, to: number) =>
    EditorState.create({ doc, selection: TextSelection.create(doc, from, to) });

  it('reports the words selected inside a paragraph, with the rest of it around them', () => {
    expect(noteSelectionOf(at(5, 11))).toEqual({
      text: 'SAMPLE',
      before: 'One ',
      after: ' word here.',
    });
  });

  it('joins blocks with line breaks and leaves out the context across blocks', () => {
    const end = doc.content.size - 1;
    expect(noteSelectionOf(at(1, end))).toEqual({
      text: 'One SAMPLE word here.\n \nSecond line.',
      before: null,
      after: null,
    });
  });

  it('reports nothing for an empty selection or a selected image', () => {
    expect(noteSelectionOf(at(3, 3))).toBeNull();
    const image = EditorState.create({ doc, selection: NodeSelection.create(doc, 23) });
    expect((image.selection as NodeSelection).node.type.name).toBe('image');
    expect(noteSelectionOf(image)).toBeNull();
  });
});
