/* global describe, it, expect, __dirname */
// Plain JS (not TS) because it reads files from disk with Node APIs.
// Keeps global.css and tailwind.config.js in step with src/theme/tokens.ts.
const { readFileSync } = require('fs');
const { join } = require('path');

const { colorNames, cssVariables } = require('../tokens');

const root = join(__dirname, '..', '..', '..');

describe('theme config files match tokens.ts', () => {
  it('global.css :root fallback matches the light palette', () => {
    const css = readFileSync(join(root, 'global.css'), 'utf8');
    for (const [name, value] of Object.entries(cssVariables('light'))) {
      expect(css).toContain(`${name}: ${value};`);
    }
  });

  it('tailwind.config.js exposes every token colour', () => {
    const config = require(join(root, 'tailwind.config.js'));
    expect(Object.keys(config.theme.extend.colors).sort()).toEqual([...colorNames].sort());
  });
});
