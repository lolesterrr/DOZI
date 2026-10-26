import { formatInTimeZone } from 'date-fns-tz';

import { parseMediaRef } from '@/features/media/logic';
import { isCalloutKind, type DocNode } from '@/features/notes/logic';
import {
  calloutColours,
  highlightColours,
  type HighlightColour,
} from '@/features/notes/editor/css';
import type { CardField } from '@/features/decks/logic';
import {
  blankIdsInText,
  distinctRights,
  parseBlankText,
  type QuestionDraft,
} from '@/features/quizzes/logic';
import { strings } from '@/i18n/strings';
import { DEFAULT_TIMEZONE } from '@/lib/time';
import { palettes, type ColorName } from '@/theme';

// Builds the HTML that expo-print turns into a PDF (task 1.12): a note, or a quiz with or
// without its answers. Pure — images come in as a map of media id → data: URI, because the
// print engine can't read app files — so all of it is unit-tested. Every piece of the
// student's text is escaped. Printed on white paper, so the light theme's colours are used.

const t = strings.transfer.pdf;
const colors = palettes.light;

/** Media id → a `data:` URI for the image, or null when the file isn't on this phone. */
export type ImageSources = ReadonlyMap<string, string | null>;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A file name from a title, without the characters file systems refuse. */
export function exportFileName(title: string, extension: 'csv' | 'pdf'): string {
  const safe = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim();
  return `${safe || 'Dozi'}.${extension}`;
}

/** "26 Oct 2026" in Kampala time, for the line under the title. */
export function formatExportDate(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(iso, timeZone, 'd MMM yyyy');
}

const softPair = (name: HighlightColour) => ({
  bg: colors[`${name}-soft` as ColorName],
  fg: colors[`on-${name}-soft` as ColorName],
});

/** The page's styles. Callouts and highlights use the same colour pairs as the editor. */
function pageCss(): string {
  const marks = highlightColours
    .map((name) => {
      const { bg, fg } = softPair(name);
      return `mark[data-color="${name}"] { background: ${bg}; color: ${fg}; }`;
    })
    .join('\n');
  const callouts = Object.entries(calloutColours)
    .map(([kind, name]) => {
      const { bg, fg } = softPair(name);
      return `.callout[data-callout="${kind}"] { background: ${bg}; color: ${fg}; border-left-color: ${fg}; }`;
    })
    .join('\n');
  return `
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Roboto, "Segoe UI", Arial, sans-serif; font-size: 11.5pt;
      line-height: 1.45; color: ${colors.fg}; background: ${colors.surface}; margin: 0; }
    h1 { font-size: 20pt; margin: 0 0 2pt; line-height: 1.2; }
    h2 { font-size: 15pt; margin: 14pt 0 4pt; } h3 { font-size: 12.5pt; margin: 12pt 0 4pt; }
    h4, h5, h6 { font-size: 11.5pt; margin: 10pt 0 4pt; }
    p { margin: 4pt 0; }
    .meta { color: ${colors['fg-muted']}; font-size: 9.5pt; margin: 0 0 12pt; }
    .disclaimer { color: ${colors['fg-muted']}; font-size: 9pt; border-top: 1px solid ${colors.border};
      margin-top: 20pt; padding-top: 6pt; }
    a { color: ${colors.primary}; }
    mark { background: ${colors['accent-soft']}; color: ${colors['on-accent-soft']}; padding: 0 2px; border-radius: 2px; }
    ${marks}
    blockquote { border-left: 3px solid ${colors.primary}; margin: 6pt 0; padding-left: 10pt;
      color: ${colors['fg-muted']}; }
    code, pre { font-family: Menlo, "Roboto Mono", monospace; background: ${colors['surface-muted']};
      border-radius: 3px; }
    code { padding: 0 3px; } pre { padding: 6pt 8pt; white-space: pre-wrap; }
    hr { border: none; border-top: 1px solid ${colors.border}; margin: 12pt 0; }
    img { max-width: 100%; max-height: 120mm; display: block; margin: 6pt 0; page-break-inside: avoid; }
    table { border-collapse: collapse; width: 100%; margin: 8pt 0; page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    td, th { border: 1px solid ${colors.border}; padding: 4pt 6pt; vertical-align: top; text-align: left; }
    th { background: ${colors['surface-muted']}; }
    td > p, th > p { margin: 0; }
    ul.tasks { list-style: none; padding-left: 4pt; }
    ul.tasks li { display: flex; gap: 4pt; }
    ul.tasks .box { flex: none; width: 1.4em; }
    ul.tasks li > p { margin: 0; }
    .callout { border-left: 4px solid; border-radius: 4px; padding: 6pt 10pt; margin: 8pt 0;
      page-break-inside: avoid; }
    .callout-label { font-weight: 700; font-size: 9.5pt; text-transform: uppercase;
      letter-spacing: 0.03em; margin-bottom: 2pt; }
    ${callouts}
    .missing { color: ${colors['fg-muted']}; font-style: italic; }
    .question { page-break-inside: avoid; margin: 0 0 14pt; }
    .question h2 { font-size: 12.5pt; margin: 0 0 4pt; }
    .question h2 .pts { color: ${colors['fg-muted']}; font-weight: 400; font-size: 10pt; }
    .help { color: ${colors['fg-muted']}; font-size: 10pt; font-style: italic; }
    ol.options { list-style: upper-alpha; padding-left: 20pt; margin: 4pt 0; }
    ol.options li, ol.statements li { margin: 2pt 0; }
    .tf { color: ${colors['fg-muted']}; white-space: nowrap; }
    .blank { display: inline-block; min-width: 26mm; border-bottom: 1px solid ${colors.fg}; }
    .lines { border-bottom: 1px solid ${colors.border}; height: 9mm; }
    .match td { width: 50%; }
    .answers { page-break-before: always; }
    .answer { page-break-inside: avoid; margin: 0 0 10pt; }
    .answer h3 { margin: 0 0 2pt; font-size: 11.5pt; }
    .right { color: ${colors['on-success-soft']}; font-weight: 700; }
    .why { color: ${colors['fg-muted']}; }
  `;
}

/** A whole HTML page: the title, the export date, the body, and the study disclaimer. */
export function htmlPage(title: string, exportedAt: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${pageCss()}</style></head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml(t.exportedOn(formatExportDate(exportedAt)))}</p>
${body}
<p class="disclaimer">${escapeHtml(strings.disclaimer)}</p>
</body></html>`;
}

function imageHtml(mediaId: string | null, images: ImageSources): string {
  const src = mediaId ? images.get(mediaId) : null;
  if (!src) return `<p class="missing">${escapeHtml(t.imageMissing)}</p>`;
  return `<img src="${escapeHtml(src)}" alt="" />`;
}

// ---------------------------------------------------------------------------------------------
// Notes (ProseMirror JSON → HTML)

const safeUrl = (href: unknown): string | null =>
  typeof href === 'string' && /^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : null;

function markOpen(mark: { type: string; attrs?: Record<string, unknown> }): [string, string] {
  switch (mark.type) {
    case 'bold':
      return ['<strong>', '</strong>'];
    case 'italic':
      return ['<em>', '</em>'];
    case 'underline':
      return ['<u>', '</u>'];
    case 'strike':
      return ['<s>', '</s>'];
    case 'code':
      return ['<code>', '</code>'];
    case 'highlight': {
      const colour = mark.attrs?.color;
      const known = (highlightColours as readonly unknown[]).includes(colour);
      return [known ? `<mark data-color="${colour as string}">` : '<mark>', '</mark>'];
    }
    case 'link': {
      const href = safeUrl(mark.attrs?.href);
      return href ? [`<a href="${escapeHtml(href)}">`, '</a>'] : ['', ''];
    }
    default:
      return ['', ''];
  }
}

function textHtml(node: DocNode): string {
  let html = escapeHtml(node.text ?? '');
  for (const mark of node.marks ?? []) {
    const [open, close] = markOpen(mark);
    html = `${open}${html}${close}`;
  }
  return html;
}

const headingLevel = (attrs: DocNode['attrs']): number => {
  const level = Number(attrs?.level);
  // The note's title is the h1, so headings in the note start at h2.
  return Number.isInteger(level) ? Math.min(6, Math.max(2, level + 1)) : 2;
};

function nodeHtml(node: DocNode, images: ImageSources): string {
  const children = () => (node.content ?? []).map((child) => nodeHtml(child, images)).join('');
  switch (node.type) {
    case 'doc':
      return children();
    case 'text':
      return textHtml(node);
    case 'hardBreak':
      return '<br />';
    case 'paragraph':
      return `<p>${children() || '&nbsp;'}</p>`;
    case 'heading': {
      const level = headingLevel(node.attrs);
      return `<h${level}>${children()}</h${level}>`;
    }
    case 'bulletList':
      return `<ul>${children()}</ul>`;
    case 'orderedList': {
      const start = Number(node.attrs?.start);
      return Number.isInteger(start) && start > 1
        ? `<ol start="${start}">${children()}</ol>`
        : `<ol>${children()}</ol>`;
    }
    case 'listItem':
      return `<li>${children()}</li>`;
    case 'taskList':
      return `<ul class="tasks">${children()}</ul>`;
    case 'taskItem':
      return `<li><span class="box">${node.attrs?.checked ? '☑' : '☐'}</span>${children()}</li>`;
    case 'blockquote':
      return `<blockquote>${children()}</blockquote>`;
    case 'codeBlock':
      return `<pre><code>${(node.content ?? []).map((c) => escapeHtml(c.text ?? '')).join('')}</code></pre>`;
    case 'horizontalRule':
      return '<hr />';
    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? parseMediaRef(node.attrs.src) : null;
      return imageHtml(src, images);
    }
    case 'table':
      return `<table>${children()}</table>`;
    case 'tableRow':
      return `<tr>${children()}</tr>`;
    case 'tableHeader':
    case 'tableCell': {
      const tag = node.type === 'tableHeader' ? 'th' : 'td';
      const span = (name: 'colspan' | 'rowspan') => {
        const n = Number(node.attrs?.[name]);
        return Number.isInteger(n) && n > 1 ? ` ${name}="${n}"` : '';
      };
      return `<${tag}${span('colspan')}${span('rowspan')}>${children()}</${tag}>`;
    }
    case 'callout': {
      const kind = isCalloutKind(node.attrs?.kind) ? node.attrs.kind : 'examTip';
      return `<div class="callout" data-callout="${kind}"><div class="callout-label">${escapeHtml(
        strings.notes.callouts[kind],
      )}</div>${children()}</div>`;
    }
    default:
      // Anything newer than this exporter: keep its text.
      return children();
  }
}

/** A note as a printable page. */
export function noteToHtml(input: {
  title: string;
  doc: DocNode;
  images: ImageSources;
  exportedAt: string;
}): string {
  return htmlPage(input.title, input.exportedAt, nodeHtml(input.doc, input.images));
}

// ---------------------------------------------------------------------------------------------
// Quizzes

/** A plain field (lines of text, then images), e.g. a question's stem. */
function fieldHtml(field: CardField, images: ImageSources): string {
  const text = field.text.replace(/\s+$/, '');
  const lines = text
    ? text
        .split('\n')
        .map((line) => `<p>${escapeHtml(line) || '&nbsp;'}</p>`)
        .join('')
    : '';
  return lines + field.mediaIds.map((id) => imageHtml(id, images)).join('');
}

const lines = (text: string) => escapeHtml(text).replace(/\n/g, '<br />');

function fillBlankHtml(text: string): string {
  return parseBlankText(text)
    .map((part) => (part.type === 'text' ? lines(part.text) : '<span class="blank">&nbsp;</span>'))
    .join('');
}

/** What the paper shows for a question, before any answers. */
function questionBodyHtml(draft: QuestionDraft): string {
  switch (draft.type) {
    case 'sba':
      return `<ol class="options">${draft.payload.options
        .map((o) => `<li>${lines(o.text)}</li>`)
        .join('')}</ol>`;
    case 'multiple_response':
      return `<p class="help">${escapeHtml(t.chooseAll)}</p><ol class="options">${draft.payload.options
        .map((o) => `<li>${lines(o.text)}</li>`)
        .join('')}</ol>`;
    case 'mtf':
      return `<ol class="statements" type="a">${draft.payload.statements
        .map(
          (s) => `<li>${lines(s.text)} <span class="tf">— ${escapeHtml(t.trueFalse)}</span></li>`,
        )
        .join('')}</ol>`;
    case 'fill_blank':
      return `<p>${fillBlankHtml(draft.payload.text)}</p>`;
    case 'matching': {
      // The right-hand column in A–Z order, so the paper doesn't give the answers away.
      const rights = [...distinctRights(draft.payload.pairs)].sort((a, b) =>
        a.localeCompare(b, 'en-GB', { sensitivity: 'base' }),
      );
      const rows = Math.max(draft.payload.pairs.length, rights.length);
      const cells = Array.from({ length: rows }, (_, i) => {
        const left = draft.payload.pairs[i];
        const right = rights[i];
        return `<tr><td>${left ? `${i + 1}. ${lines(left.left)}` : ''}</td><td>${
          right !== undefined ? `${letter(i)}. ${lines(right)}` : ''
        }</td></tr>`;
      }).join('');
      return `<p class="help">${escapeHtml(t.matchHelp)}</p><table class="match">${cells}</table>`;
    }
    case 'saq':
      return `<p class="help">${escapeHtml(t.answerSpace)}</p>${'<div class="lines"></div>'.repeat(6)}`;
  }
}

const letter = (index: number) => String.fromCharCode(65 + index);

/** The answer key for one question. */
function answerHtml(draft: QuestionDraft, images: ImageSources): string {
  const why = (text: string) =>
    text.trim() ? ` <span class="why">— ${lines(text.trim())}</span>` : '';
  let body = '';
  switch (draft.type) {
    case 'sba':
    case 'multiple_response':
      body = `<ol class="options">${draft.payload.options
        .map(
          (o) =>
            `<li>${o.correct ? `<span class="right">✓ ${escapeHtml(t.correct)}:</span> ` : ''}${lines(o.text)}${why(o.why)}</li>`,
        )
        .join('')}</ol>`;
      break;
    case 'mtf':
      body = `<ol class="statements" type="a">${draft.payload.statements
        .map(
          (s) =>
            `<li><span class="right">${escapeHtml(s.answer ? t.true : t.false)}</span> — ${lines(s.text)}${why(s.why)}</li>`,
        )
        .join('')}</ol>`;
      break;
    case 'fill_blank': {
      const order = blankIdsInText(draft.payload.text);
      body = order
        .map((id, i) => {
          const blank = draft.payload.blanks.find((b) => b.id === id);
          const answers = (blank?.answers ?? []).filter((a) => a.trim() !== '');
          return `<p>${escapeHtml(t.blankAnswer(i + 1, answers.join(t.orSeparator)))}</p>`;
        })
        .join('');
      break;
    }
    case 'matching': {
      const rights = [...distinctRights(draft.payload.pairs)].sort((a, b) =>
        a.localeCompare(b, 'en-GB', { sensitivity: 'base' }),
      );
      body = draft.payload.pairs
        .map((pair, i) => {
          const at = rights.findIndex(
            (r) => r.localeCompare(pair.right, 'en-GB', { sensitivity: 'base' }) === 0,
          );
          const right = at === -1 ? pair.right : `${letter(at)}. ${pair.right}`;
          return `<p>${escapeHtml(t.matchAnswer(`${i + 1}. ${pair.left}`, right))}</p>`;
        })
        .join('');
      break;
    }
    case 'saq': {
      const points = draft.payload.marking_points.filter((m) => m.text.trim() !== '');
      body =
        (points.length
          ? `<p><strong>${escapeHtml(t.markingPoints)}</strong></p><ul>${points
              .map((m) => `<li>${lines(m.text)}</li>`)
              .join('')}</ul>`
          : '') +
        (draft.payload.model_answer.trim()
          ? `<p><strong>${escapeHtml(t.modelAnswer)}</strong></p><p>${lines(draft.payload.model_answer.trim())}</p>`
          : '');
      break;
    }
  }
  const explanation =
    draft.explanation.text.trim() || draft.explanation.mediaIds.length
      ? `<p><strong>${escapeHtml(t.explanation)}</strong></p>${fieldHtml(draft.explanation, images)}`
      : '';
  return body + explanation;
}

export type PrintableQuestion = { draft: QuestionDraft | null; points: number };

/** A quiz as a printable paper, with the answer key on a new page when `withAnswers`. */
export function quizToHtml(input: {
  title: string;
  description: string;
  questions: readonly PrintableQuestion[];
  withAnswers: boolean;
  images: ImageSources;
  exportedAt: string;
}): string {
  const heading = (n: number, points: number, tag: 'h2' | 'h3') =>
    `<${tag}>${escapeHtml(t.question(n))}${
      tag === 'h2' ? ` <span class="pts">(${escapeHtml(t.points(points))})</span>` : ''
    }</${tag}>`;
  const questions = input.questions
    .map(({ draft, points }, i) => {
      if (!draft) {
        return `<div class="question">${heading(i + 1, points, 'h2')}<p class="missing">${escapeHtml(t.unreadable)}</p></div>`;
      }
      return `<div class="question">${heading(i + 1, points, 'h2')}${fieldHtml(draft.stem, input.images)}${questionBodyHtml(draft)}</div>`;
    })
    .join('\n');
  const answers = input.withAnswers
    ? `<div class="answers"><h2>${escapeHtml(t.answers)}</h2>${input.questions
        .map(({ draft, points }, i) =>
          draft
            ? `<div class="answer">${heading(i + 1, points, 'h3')}${answerHtml(draft, input.images)}</div>`
            : '',
        )
        .join('\n')}</div>`
    : '';
  const description = input.description.trim() ? `<p>${lines(input.description.trim())}</p>` : '';
  return htmlPage(input.title, input.exportedAt, description + questions + answers);
}

/** Every image a quiz paper shows (stems, and explanations when answers are included). */
export function quizMediaIds(
  questions: readonly PrintableQuestion[],
  withAnswers: boolean,
): string[] {
  const ids = new Set<string>();
  for (const { draft } of questions) {
    if (!draft) continue;
    draft.stem.mediaIds.forEach((id) => ids.add(id));
    if (withAnswers) draft.explanation.mediaIds.forEach((id) => ids.add(id));
  }
  return [...ids];
}
