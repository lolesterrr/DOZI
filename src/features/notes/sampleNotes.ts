import type { DocNode } from './logic';

// Made-up SAMPLE notes for checking search speed (task 1.4: 500 notes). The words are ordinary
// study vocabulary strung together at random: no drug facts, and every title starts "SAMPLE".

const words = (
  'study revision lecture chapter summary question answer example practice review topic ' +
  'detail outline diagram table figure section page reading library group tutorial seminar ' +
  'morning evening weekend schedule plan goal progress memory recall focus break notebook ' +
  'highlight colour heading list point idea concept theory method result discussion ' +
  'introduction conclusion source reference journal article textbook handout slide board ' +
  'campus hall classmate lecturer tutor mentor friend semester year module unit course exam ' +
  'test quiz assignment deadline draft report essay paragraph sentence keyword glossary term ' +
  'definition comparison contrast pattern sequence process stage step cycle system structure ' +
  'function balance change growth level rate measure value number count total average ' +
  'quick slow early late short long simple careful clear bright quiet busy calm steady'
).split(' ');

/** A small repeatable random number generator, so SAMPLE notes are the same on every run. */
function generator(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function sentence(next: () => number, length: number): string {
  const picked = Array.from({ length }, () => words[Math.floor(next() * words.length)]);
  const text = picked.join(' ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/** `count` SAMPLE notes of about 150 words each: a heading and three paragraphs. */
export function sampleNotes(count: number, seed = 2026): { title: string; doc: DocNode }[] {
  const next = generator(seed);
  return Array.from({ length: count }, (_, index) => {
    const paragraph = () => ({
      type: 'paragraph',
      content: [{ type: 'text', text: [12, 14, 16].map((n) => sentence(next, n)).join(' ') }],
    });
    return {
      title: `SAMPLE ${index + 1}: ${sentence(next, 3).slice(0, -1)}`,
      doc: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'SAMPLE' }] },
          paragraph(),
          paragraph(),
          paragraph(),
        ],
      },
    };
  });
}
