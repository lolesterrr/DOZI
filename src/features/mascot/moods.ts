// PRODUCT_SPEC §9 — Dozi's expressions.
export const doziMoods = [
  'idle',
  'happy',
  'celebrating',
  'thinking',
  'encouraging',
  'concerned',
  'sleepy',
  'studying',
  'proud',
  'surprised',
] as const;
export type DoziMood = (typeof doziMoods)[number];
