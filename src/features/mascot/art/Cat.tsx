import type { ReactNode } from 'react';
import { Circle, Ellipse, G, Path } from 'react-native-svg';

import { art } from './colours';

// Dozi's shared drawing: a tuxedo cat (black fur, white blaze, muzzle and chest) in a white lab
// coat, on a 100 × 100 canvas. Each mood (moods.tsx) picks eyes, mouth and brows and adds its
// own arms and props on top.

export type EyeKind = 'open' | 'happy' | 'closed' | 'wide';
export type MouthKind = 'smile' | 'grin' | 'flat' | 'frown' | 'oh';

export type CatProps = {
  eyes?: EyeKind;
  mouth?: MouthKind;
  /** Slanted worried eyebrows. */
  worried?: boolean;
  /** Where the pupils look, in canvas units. */
  look?: { dx: number; dy: number };
  /** Drawn on top of the cat: arms, paws and props. */
  children?: ReactNode;
  /** Drawn behind the cat. */
  behind?: ReactNode;
};

const EYE_Y = 38;
const EYES = [40, 60] as const;

function Eye({ kind, x, look }: { kind: EyeKind; x: number; look: { dx: number; dy: number } }) {
  if (kind === 'happy') {
    return (
      <Path
        d={`M${x - 4} ${EYE_Y + 1.5} Q${x} ${EYE_Y - 5} ${x + 4} ${EYE_Y + 1.5}`}
        stroke={art.eye}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  if (kind === 'closed') {
    return (
      <Path
        d={`M${x - 4} ${EYE_Y - 1} Q${x} ${EYE_Y + 4} ${x + 4} ${EYE_Y - 1}`}
        stroke={art.eye}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  const r = kind === 'wide' ? 5.6 : 4.2;
  return (
    <G>
      <Circle cx={x} cy={EYE_Y} r={r} fill={art.eye} />
      <Ellipse
        cx={x + look.dx}
        cy={EYE_Y + look.dy}
        rx={kind === 'wide' ? 1.8 : 1.5}
        ry={kind === 'wide' ? 2.2 : 3}
        fill={art.pupil}
      />
      <Circle cx={x + look.dx + 1.3} cy={EYE_Y + look.dy - 1.5} r={0.9} fill={art.white} />
    </G>
  );
}

function Mouth({ kind }: { kind: MouthKind }) {
  const line = {
    stroke: art.pupil,
    strokeWidth: 1.4,
    strokeLinecap: 'round',
    fill: 'none',
  } as const;
  switch (kind) {
    case 'grin':
      return (
        <Path
          d="M43.5 52 Q50 63 56.5 52 Z"
          fill={art.mouthInside}
          stroke={art.pupil}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      );
    case 'flat':
      return <Path d="M46 54 H54" {...line} />;
    case 'frown':
      return <Path d="M44.5 56 Q47 52 50 54.5 Q53 52 55.5 56" {...line} />;
    case 'oh':
      return (
        <Ellipse
          cx={50}
          cy={56}
          rx={2.8}
          ry={3.8}
          fill={art.mouthInside}
          stroke={art.pupil}
          strokeWidth={1}
        />
      );
    default:
      return <Path d="M44 52.5 Q47 57 50 53 Q53 57 56 52.5" {...line} />;
  }
}

/** The cat itself: tail, lab coat, head and face. Moods add arms and props via `children`. */
export function Cat({
  eyes = 'open',
  mouth = 'smile',
  worried = false,
  look = { dx: 0, dy: 0 },
  children,
  behind,
}: CatProps) {
  return (
    <G>
      {behind}
      {/* Tail */}
      <Path
        d="M68 90 C90 92 96 72 86 60"
        stroke={art.furRim}
        strokeWidth={8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M68 90 C90 92 96 72 86 60"
        stroke={art.fur}
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
      {/* Lab coat over a black body, with the white chest showing at the collar */}
      <Path
        d="M29 99 L31 72 Q50 62 69 72 L71 99 Z"
        fill={art.white}
        stroke={art.whiteEdge}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path
        d="M41 66 L50 82 L59 66"
        fill="none"
        stroke={art.whiteEdge}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path d="M50 82 V99" stroke={art.whiteEdge} strokeWidth={1.2} />
      <Circle cx={53} cy={88} r={1.1} fill={art.whiteEdge} />
      <Path
        d="M58 86 H66 V92 H58 Z"
        fill="none"
        stroke={art.whiteEdge}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      {/* Ears */}
      <Path
        d="M30 30 L29 8 L46 21 Z"
        fill={art.fur}
        stroke={art.furRim}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path
        d="M70 30 L71 8 L54 21 Z"
        fill={art.fur}
        stroke={art.furRim}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path d="M33 25 L32.5 14 L41 21 Z" fill={art.pink} />
      <Path d="M67 25 L67.5 14 L59 21 Z" fill={art.pink} />
      {/* Head, white blaze and muzzle */}
      <Circle cx={50} cy={41} r={22} fill={art.fur} stroke={art.furRim} strokeWidth={1.4} />
      <Path
        d="M50 21 C47 29 46.5 37 43 46 C44 57 56 57 57 46 C53.5 37 53 29 50 21 Z"
        fill={art.white}
      />
      <Ellipse cx={50} cy={50.5} rx={11} ry={8.5} fill={art.white} />
      <Path d="M47 46 H53 L50 50 Z" fill={art.pink} />
      <Path d="M50 50 V52.5" stroke={art.pupil} strokeWidth={1.2} strokeLinecap="round" />
      <Mouth kind={mouth} />
      {/* Whiskers */}
      <Path
        d="M38 50 L25 47 M38 53 L25 55 M62 50 L75 47 M62 53 L75 55"
        stroke={art.whisker}
        strokeWidth={0.9}
        strokeLinecap="round"
      />
      {/* Eyes and brows */}
      {EYES.map((x) => (
        <Eye key={x} kind={eyes} x={x} look={look} />
      ))}
      {worried ? (
        <Path
          d="M34 31 L44 27.5 M66 31 L56 27.5"
          stroke={art.brow}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ) : null}
      {children}
    </G>
  );
}
