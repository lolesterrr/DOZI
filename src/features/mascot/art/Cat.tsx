import type { ReactNode } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { art } from './colours';

// Monsieur Pierre's shared drawing, on a 100 × 100 canvas: a chubby tuxedo cat (dark fur, white
// muzzle and chest, green eyes with heavy, laid-back lids) in his red beret and a white pharmacist's
// coat with a green pharmacy cross. Each mood (moods.tsx) picks eyes, mouth and brows and adds its
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

const EYE_Y = 40;
const EYES = [39, 61] as const;

function Eye({ kind, x, look }: { kind: EyeKind; x: number; look: { dx: number; dy: number } }) {
  if (kind === 'happy') {
    return (
      <Path
        d={`M${x - 4.5} ${EYE_Y + 1.5} Q${x} ${EYE_Y - 5} ${x + 4.5} ${EYE_Y + 1.5}`}
        stroke={art.eye}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  if (kind === 'closed') {
    return (
      <Path
        d={`M${x - 4.5} ${EYE_Y - 1} Q${x} ${EYE_Y + 4} ${x + 4.5} ${EYE_Y - 1}`}
        stroke={art.eye}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  const wide = kind === 'wide';
  const r = wide ? 5.8 : 4.6;
  return (
    <G>
      <Circle cx={x} cy={EYE_Y} r={r} fill={art.eye} />
      <Ellipse
        cx={x + look.dx}
        cy={EYE_Y + look.dy + (wide ? 0 : 0.8)}
        rx={wide ? 1.9 : 1.6}
        ry={wide ? 2.3 : 2.8}
        fill={art.pupil}
      />
      <Circle cx={x + look.dx + 1.4} cy={EYE_Y + look.dy - 0.4} r={0.9} fill={art.white} />
      {/* Pierre's heavy upper lid: calm, a little sleepy, never in a hurry */}
      {wide ? null : (
        <G>
          <Path
            d={`M${x - 5.4} ${EYE_Y - 0.6} Q${x} ${EYE_Y - 3.2} ${x + 5.4} ${EYE_Y - 0.6} V${EYE_Y - 6} H${x - 5.4} Z`}
            fill={art.fur}
          />
          <Path
            d={`M${x - 5} ${EYE_Y - 0.6} Q${x} ${EYE_Y - 3.2} ${x + 5} ${EYE_Y - 0.6}`}
            stroke={art.outline}
            strokeWidth={1.3}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      )}
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
          d="M43.5 53 Q50 64 56.5 53 Z"
          fill={art.mouthInside}
          stroke={art.pupil}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      );
    case 'flat':
      return <Path d="M46 55 H54" {...line} />;
    case 'frown':
      return <Path d="M44.5 57 Q47 53 50 55.5 Q53 53 55.5 57" {...line} />;
    case 'oh':
      return (
        <Ellipse
          cx={50}
          cy={57}
          rx={2.8}
          ry={3.8}
          fill={art.mouthInside}
          stroke={art.pupil}
          strokeWidth={1}
        />
      );
    default:
      return <Path d="M44 53.5 Q47 58 50 54 Q53 58 56 53.5" {...line} />;
  }
}

/** The green pharmacy cross, centred on (x, y). `s` is its full width. */
export function PharmacyCross({ x, y, s }: { x: number; y: number; s: number }) {
  const t = s / 3;
  const d =
    `M${x - t / 2} ${y - s / 2} H${x + t / 2} V${y - t / 2} H${x + s / 2} V${y + t / 2} ` +
    `H${x + t / 2} V${y + s / 2} H${x - t / 2} V${y + t / 2} H${x - s / 2} V${y - t / 2} ` +
    `H${x - t / 2} Z`;
  return (
    <Path d={d} fill={art.cross} stroke={art.crossEdge} strokeWidth={0.8} strokeLinejoin="round" />
  );
}

/** The cat itself: tail, coat, head, face and beret. Moods add arms and props via `children`. */
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
        d="M70 92 C92 94 97 74 87 62"
        stroke={art.furRim}
        strokeWidth={9}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M70 92 C92 94 97 74 87 62"
        stroke={art.fur}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
      {/* A round, well-fed body in a pharmacist's coat, white chest showing at the collar */}
      <Path
        d="M22 100 Q19 77 33 70 Q50 62 67 70 Q81 77 78 100 Z"
        fill={art.white}
        stroke={art.whiteEdge}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path
        d="M40 66 L50 83 L60 66"
        fill="none"
        stroke={art.whiteEdge}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path d="M50 83 V100" stroke={art.whiteEdge} strokeWidth={1.2} />
      <Circle cx={53} cy={89} r={1.1} fill={art.whiteEdge} />
      <Circle cx={53} cy={95} r={1.1} fill={art.whiteEdge} />
      <PharmacyCross x={41} y={78} s={6.5} />
      {/* Breast pocket with a pen */}
      <Path d="M62 81 V86" stroke={art.book} strokeWidth={1.6} strokeLinecap="round" />
      <Path
        d="M58 84 H67 V91 H58 Z"
        fill={art.white}
        stroke={art.whiteEdge}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      {/* Ears */}
      <Path
        d="M28 33 L27 9 L45 22 Z"
        fill={art.fur}
        stroke={art.furRim}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path
        d="M72 33 L73 9 L55 22 Z"
        fill={art.fur}
        stroke={art.furRim}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path d="M31 27 L30.5 15 L40 22 Z" fill={art.pink} />
      <Path d="M69 27 L69.5 15 L60 22 Z" fill={art.pink} />
      {/* A wide, chubby head with a white muzzle and chin */}
      <Ellipse
        cx={50}
        cy={42}
        rx={25}
        ry={21.5}
        fill={art.fur}
        stroke={art.furRim}
        strokeWidth={1.4}
      />
      <Path d="M35 52 Q38 44 50 45 Q62 44 65 52 Q62 63 50 63 Q38 63 35 52 Z" fill={art.white} />
      <Path d="M47 47 H53 L50 51 Z" fill={art.pink} />
      <Path d="M50 51 V53.5" stroke={art.pupil} strokeWidth={1.2} strokeLinecap="round" />
      <Mouth kind={mouth} />
      {/* Whiskers */}
      <Path
        d="M37 51 L22 48 M37 54 L22 56 M63 51 L78 48 M63 54 L78 56"
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
          d="M32 33 L43 29.5 M68 33 L57 29.5"
          stroke={art.brow}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ) : null}
      {/* His red beret, tipped to one side */}
      <G rotation={-12} origin="47, 21">
        <Ellipse
          cx={47}
          cy={20}
          rx={18.5}
          ry={7.5}
          fill={art.beret}
          stroke={art.beretEdge}
          strokeWidth={1.3}
        />
        <Path d="M31 21.5 Q47 26.5 63 21.5" stroke={art.beretEdge} strokeWidth={1} fill="none" />
        <Rect x={46} y={9} width={2.4} height={4} rx={1} fill={art.beretEdge} />
      </G>
      {children}
    </G>
  );
}
