import { palettes } from '@/theme';

import { CONTENT_MESSAGE, createContentSyncBridge, noteEditorBridges } from '../bridges';
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
    expect(names).toEqual(expect.arrayContaining(['horizontalRule', 'callout', 'doziContentSync']));
    expect(new Set(names).size).toBe(names.length);
  });

  it('is built into the WebView bundle (run `npm run editor:build` if this fails)', () => {
    for (const marker of [
      'dozi-table',
      'dozi-divider',
      'dozi-callout',
      'dozi-insert-image',
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
