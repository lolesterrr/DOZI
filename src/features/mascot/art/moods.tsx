import type { ComponentType } from 'react';
import { G, Path } from 'react-native-svg';

import { doziMoods, type DoziMood } from '../moods';
import { pierrePalette, pierreSprites } from './sprites';

// Monsieur Pierre in pixel art, the same style as his sprites in the developer's other projects.
// The frames come from tools/pierre/make_dozi.py (npm run mascot:build) into sprites.ts; this file
// turns each 32 × 32 frame into one SVG path per colour, so it stays sharp at any size.
// Dozi.tsx draws on a 100 × 100 canvas: the frame is scaled by 2.5 with a 4-pixel margin, so the
// round badge doesn't cut off his ears or props.

const SCALE = 2.5;
const MARGIN = 4;
// Each run is drawn a hair wider and taller so no hairline gap shows between neighbouring pixels.
const BLEED = 0.04;

/** One path per colour: each horizontal run of same-coloured pixels becomes a rectangle. */
export function spritePaths(rows: readonly string[]): { colour: string; d: string }[] {
  const byKey = new Map<string, string[]>();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === key) end += 1;
      if (key !== '.') {
        const parts = byKey.get(key) ?? [];
        parts.push(`M${x} ${y}h${end - x + BLEED}v${1 + BLEED}h${-(end - x + BLEED)}z`);
        byKey.set(key, parts);
      }
      x = end;
    }
  });
  return [...byKey].map(([key, parts]) => {
    const colour = pierrePalette[key];
    if (!colour) throw new Error(`Unknown colour "${key}" in Pierre's sprite`);
    return { colour, d: parts.join('') };
  });
}

function makeArt(mood: DoziMood): ComponentType {
  const paths = spritePaths(pierreSprites[mood]);
  function PierreArt() {
    return (
      <G transform={`translate(${MARGIN * SCALE} ${MARGIN * SCALE}) scale(${SCALE})`}>
        {paths.map(({ colour, d }) => (
          <Path key={colour} d={d} fill={colour} />
        ))}
      </G>
    );
  }
  PierreArt.displayName = `PierreArt(${mood})`;
  return PierreArt;
}

/** One drawing per mood (PRODUCT_SPEC §9). */
export const doziArt = Object.fromEntries(doziMoods.map((mood) => [mood, makeArt(mood)])) as Record<
  DoziMood,
  ComponentType
>;
