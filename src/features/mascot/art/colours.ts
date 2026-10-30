// Monsieur Pierre's artwork colours. The mascot is a drawing, not UI, so its colours are fixed here
// (one place) instead of following the theme: the same cat appears in light and dark mode, on a
// soft badge that does follow the theme. Replacing the artwork later means replacing this folder.
// Fur, eye and pink match Pierre's pixel sprites in the developer's other projects (oneko-woah).
export const art = {
  fur: '#3A3A42',
  furRim: '#5C5C68', // thin lighter edge so the dark fur still shows on a dark badge
  outline: '#141418',
  white: '#FAFAF7',
  whiteEdge: '#AEB4BA', // coat and muzzle outline
  pink: '#F096AA',
  mouthInside: '#8E3347',
  eye: '#C4DE48',
  pupil: '#141418',
  brow: '#9A94A8',
  whisker: '#D8D4DE',
  beret: '#D0313D',
  beretEdge: '#8E1F28',
  cross: '#2FA45A', // the green pharmacy cross
  crossEdge: '#1D6B3A',
  stone: '#C9C2B6', // mortar and pestle
  stoneEdge: '#857D70',
  pill: '#E8664F',
  gold: '#E3A72F',
  goldEdge: '#9A6B0B',
  book: '#0B6B68',
  page: '#FFF8E6',
  sweat: '#7CC4E8',
  confetti: ['#E3A72F', '#F096AA', '#7CC4E8', '#2FA45A'],
} as const;
