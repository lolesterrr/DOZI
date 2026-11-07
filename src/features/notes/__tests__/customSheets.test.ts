import { strings } from '@/i18n/strings';

import {
  addCustomSheet,
  customSheetDoc,
  customSheetName,
  customTemplateValue,
  CUSTOM_SHEETS_MAX,
  isUntouchedCustomSheet,
  moveItem,
  newBox,
  noteStartInput,
  parseCustomSheets,
  sheetProblem,
  type CustomSheet,
} from '../customSheets';
import { docToText, type DocNode } from '../logic';

const t = strings.notes.customSheet;

const sheet: CustomSheet = {
  id: 's1',
  name: 'Lab sheet',
  boxes: [newBox('notes'), newBox('table'), newBox('mnemonic'), newBox('howSure')],
};

describe('parseCustomSheets', () => {
  it('keeps valid sheets and skips damaged ones', () => {
    expect(parseCustomSheets([sheet, { id: 'x', name: '', boxes: [] }, 'junk'])).toEqual([sheet]);
    expect(parseCustomSheets(undefined)).toEqual([]);
    expect(parseCustomSheets({})).toEqual([]);
  });
});

describe('sheetProblem', () => {
  it('needs a new name and at least one box', () => {
    expect(sheetProblem('  ', [newBox('notes')], [])).toBe(t.nameNeeded);
    expect(sheetProblem('lab SHEET', [newBox('notes')], [sheet])).toBe(t.nameTaken);
    expect(sheetProblem('Other', [], [])).toBe(t.noBoxes);
    expect(sheetProblem('Other', [newBox('notes')], [sheet])).toBeNull();
  });

  it('stops at the most sheets', () => {
    const many = Array.from({ length: CUSTOM_SHEETS_MAX }, (_, i) => ({
      ...sheet,
      id: `${i}`,
      name: `S${i}`,
    }));
    expect(sheetProblem('New', [newBox('notes')], many)).toBe(t.full(CUSTOM_SHEETS_MAX));
  });
});

describe('addCustomSheet', () => {
  it('tidies the name and headings', () => {
    const [added] = addCustomSheet([], {
      id: 'a',
      name: '  My   sheet ',
      boxes: [{ kind: 'tip', title: '  Exam   tip ' }],
    });
    expect(added).toEqual({
      id: 'a',
      name: 'My sheet',
      boxes: [{ kind: 'tip', title: 'Exam tip' }],
    });
  });
});

describe('moveItem', () => {
  it('swaps with the neighbour and ignores moves off the ends', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('customSheetDoc', () => {
  it('makes a heading and an empty box for each part', () => {
    const doc = customSheetDoc(sheet);
    const types = (doc.content ?? []).map((node) => node.type);
    expect(types).toEqual([
      'heading',
      'paragraph',
      'heading',
      'table',
      'heading',
      'callout',
      'heading',
      'taskList',
    ]);
    expect(docToText(doc)).toContain(t.howSureLevels.join('\n'));
  });

  it('skips the heading of a box left without one', () => {
    const doc = customSheetDoc({ boxes: [{ kind: 'checklist', title: ' ' }] });
    expect((doc.content ?? []).map((node) => node.type)).toEqual(['taskList']);
  });
});

describe('templates', () => {
  it('stores the sheet name with the note', () => {
    expect(customTemplateValue(sheet)).toBe('custom:Lab sheet');
    expect(customSheetName('custom:Lab sheet')).toBe('Lab sheet');
    expect(customSheetName('concept')).toBeNull();
    expect(customSheetName(null)).toBeNull();
  });

  it('turns any start into what createNote needs', () => {
    expect(noteStartInput(null)).toEqual({ template: null });
    expect(noteStartInput('concept')).toEqual({ template: 'concept' });
    expect(noteStartInput(sheet)).toEqual({
      template: 'custom:Lab sheet',
      content: customSheetDoc(sheet),
    });
  });
});

describe('isUntouchedCustomSheet', () => {
  it('is true until the student writes or ticks something', () => {
    const doc = customSheetDoc(sheet);
    expect(isUntouchedCustomSheet(doc)).toBe(true);

    const written = structuredClone(doc);
    (written.content as DocNode[])[1] = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'My own words' }],
    };
    expect(isUntouchedCustomSheet(written)).toBe(false);

    const ticked = structuredClone(doc);
    const levels = (ticked.content as DocNode[])[7];
    (levels.content as DocNode[])[2].attrs = { checked: true };
    expect(isUntouchedCustomSheet(ticked)).toBe(false);
  });
});
