import type { ComponentType } from 'react';
import { Circle, G, Path, Rect } from 'react-native-svg';

import type { DoziMood } from '../moods';
import { Cat, PharmacyCross } from './Cat';
import { art } from './colours';

// One drawing of Monsieur Pierre per mood (PRODUCT_SPEC §9). To use finished artwork later, point an entry of
// `doziArt` at a component that draws it (any 100 × 100 SVG or image): nothing else changes.

const LEFT_SHOULDER = [33, 74] as const;
const RIGHT_SHOULDER = [67, 74] as const;

/** A coat sleeve from the shoulder to a black paw. */
function Arm({ from, to }: { from: readonly [number, number]; to: readonly [number, number] }) {
  const d = `M${from[0]} ${from[1]} L${to[0]} ${to[1]}`;
  return (
    <G>
      <Path d={d} stroke={art.whiteEdge} strokeWidth={9} strokeLinecap="round" />
      <Path d={d} stroke={art.white} strokeWidth={7} strokeLinecap="round" />
      <Circle cx={to[0]} cy={to[1]} r={4.6} fill={art.fur} stroke={art.furRim} strokeWidth={1.2} />
    </G>
  );
}

const ArmsDown = () => (
  <>
    <Arm from={LEFT_SHOULDER} to={[29, 91]} />
    <Arm from={RIGHT_SHOULDER} to={[71, 91]} />
  </>
);

/** A capsule centred on (x, y), turned by `turn` degrees. */
function Capsule({ x, y, turn }: { x: number; y: number; turn: number }) {
  return (
    <G rotation={turn} origin={`${x}, ${y}`}>
      <Rect x={x - 4} y={y - 1.8} width={8} height={3.6} rx={1.8} fill={art.white} />
      <Path
        d={`M${x} ${y - 1.8} H${x - 2.2} A1.8 1.8 0 0 0 ${x - 2.2} ${y + 1.8} H${x} Z`}
        fill={art.pill}
      />
      <Rect
        x={x - 4}
        y={y - 1.8}
        width={8}
        height={3.6}
        rx={1.8}
        fill="none"
        stroke={art.whiteEdge}
        strokeWidth={0.6}
      />
    </G>
  );
}

function Idle() {
  return (
    <Cat>
      <ArmsDown />
    </Cat>
  );
}

/** Happy at the bench: one paw steadies the mortar, the other works the pestle. */
function Happy() {
  return (
    <Cat eyes="happy" mouth="grin">
      <Arm from={LEFT_SHOULDER} to={[34, 84]} />
      <Path d="M52 84 L69 60" stroke={art.stoneEdge} strokeWidth={6.4} strokeLinecap="round" />
      <Path d="M52 84 L69 60" stroke={art.stone} strokeWidth={4.8} strokeLinecap="round" />
      <Path
        d="M33 78 H67 Q67 95 50 95 Q33 95 33 78 Z"
        fill={art.stone}
        stroke={art.stoneEdge}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
      <Rect x={43} y={94} width={14} height={4} rx={1.5} fill={art.stoneEdge} />
      <PharmacyCross x={50} y={86} s={6} />
      <Arm from={RIGHT_SHOULDER} to={[70, 66]} />
    </Cat>
  );
}

function Celebrating() {
  const confetti = [
    [10, 20, 0],
    [20, 8, 1],
    [84, 10, 2],
    [92, 26, 3],
    [8, 52, 2],
    [93, 50, 0],
  ] as const;
  const capsules = [
    [14, 36, 35],
    [88, 38, -30],
    [50, 5, 10],
  ] as const;
  return (
    <Cat
      eyes="happy"
      mouth="grin"
      behind={
        <>
          {confetti.map(([x, y, c]) => (
            <Rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={4}
              height={4}
              rx={1}
              fill={art.confetti[c]}
              rotation={x * 3}
              origin={`${x + 2}, ${y + 2}`}
            />
          ))}
          {capsules.map(([x, y, turn]) => (
            <Capsule key={`c-${x}`} x={x} y={y} turn={turn} />
          ))}
        </>
      }
    >
      <Arm from={LEFT_SHOULDER} to={[17, 42]} />
      <Arm from={RIGHT_SHOULDER} to={[83, 42]} />
    </Cat>
  );
}

function Thinking() {
  return (
    <Cat look={{ dx: 1.5, dy: -1.5 }} mouth="flat">
      <Arm from={LEFT_SHOULDER} to={[58, 80]} />
      <Arm from={RIGHT_SHOULDER} to={[57, 62]} />
      <Circle cx={74} cy={24} r={1.8} fill={art.whisker} />
      <Circle cx={80} cy={17} r={2.5} fill={art.whisker} />
      <Circle cx={88} cy={8} r={3.4} fill={art.whisker} />
    </Cat>
  );
}

function Encouraging() {
  return (
    <Cat eyes="happy" mouth="smile">
      <Arm from={LEFT_SHOULDER} to={[29, 91]} />
      <Arm from={RIGHT_SHOULDER} to={[79, 61]} />
      <Rect
        x={76.5}
        y={47}
        width={5}
        height={10}
        rx={2.5}
        fill={art.fur}
        stroke={art.furRim}
        strokeWidth={1.2}
      />
    </Cat>
  );
}

function Concerned() {
  return (
    <Cat worried mouth="frown">
      <Arm from={LEFT_SHOULDER} to={[47, 79]} />
      <Arm from={RIGHT_SHOULDER} to={[53, 79]} />
      <Path d="M78 22 Q74 28 78 31 Q82 28 78 22 Z" fill={art.sweat} />
    </Cat>
  );
}

function Sleepy() {
  const z = {
    stroke: art.whisker,
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  } as const;
  return (
    <Cat eyes="closed" mouth="flat">
      <ArmsDown />
      <Path d="M66 22 H73 L66 30 H73" {...z} />
      <Path d="M75 11 H80 L75 17 H80" {...z} strokeWidth={1.4} />
    </Cat>
  );
}

function Studying() {
  return (
    <Cat look={{ dx: 0, dy: 1.6 }} mouth="smile">
      <Rect x={26} y={69} width={48} height={24} rx={3} fill={art.book} />
      <Path d="M50 72 L29 70.5 V89 L50 91 Z" fill={art.page} />
      <Path d="M50 72 L71 70.5 V89 L50 91 Z" fill={art.page} />
      <Path d="M50 72 V91" stroke={art.whiteEdge} strokeWidth={1.2} />
      <Path
        d="M34 76 H45 M34 80 H45 M55 76 H66 M55 80 H66"
        stroke={art.whiteEdge}
        strokeWidth={1.1}
        strokeLinecap="round"
      />
      <Arm from={LEFT_SHOULDER} to={[29, 86]} />
      <Arm from={RIGHT_SHOULDER} to={[71, 86]} />
    </Cat>
  );
}

function Proud() {
  return (
    <Cat eyes="happy" mouth="smile">
      <Arm from={LEFT_SHOULDER} to={[29, 91]} />
      <Arm from={RIGHT_SHOULDER} to={[77, 64]} />
      <Path
        d="M70 42 H84 V49 Q84 57 77 57 Q70 57 70 49 Z"
        fill={art.gold}
        stroke={art.goldEdge}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Path
        d="M70 44 Q64 44 66 50 Q67 53 71 53 M84 44 Q90 44 88 50 Q87 53 83 53"
        fill="none"
        stroke={art.goldEdge}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <Rect x={75} y={57} width={4} height={4} fill={art.gold} />
      <Rect x={72} y={60.5} width={10} height={3} rx={1} fill={art.goldEdge} />
      <Circle cx={77} cy={64} r={4.6} fill={art.fur} stroke={art.furRim} strokeWidth={1.2} />
    </Cat>
  );
}

function Surprised() {
  const mark = { stroke: art.eye, strokeWidth: 2.2, strokeLinecap: 'round' } as const;
  return (
    <Cat eyes="wide" mouth="oh">
      <Arm from={LEFT_SHOULDER} to={[22, 58]} />
      <Arm from={RIGHT_SHOULDER} to={[78, 58]} />
      <Path d="M13 12 V21 M87 12 V21" {...mark} />
      <Circle cx={13} cy={26} r={1.4} fill={art.eye} />
      <Circle cx={87} cy={26} r={1.4} fill={art.eye} />
    </Cat>
  );
}

export const doziArt: Record<DoziMood, ComponentType> = {
  idle: Idle,
  happy: Happy,
  celebrating: Celebrating,
  thinking: Thinking,
  encouraging: Encouraging,
  concerned: Concerned,
  sleepy: Sleepy,
  studying: Studying,
  proud: Proud,
  surprised: Surprised,
};
