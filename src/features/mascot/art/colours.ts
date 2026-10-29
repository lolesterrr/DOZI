// Dozi's artwork colours. The mascot is a drawing, not UI, so its colours are fixed here (one
// place) instead of following the theme: the same cat appears in light and dark mode, on a
// soft badge that does follow the theme. Replacing the artwork later means replacing this folder.
export const art = {
  fur: '#1E1B22',
  furRim: '#4B4558', // thin lighter edge so the black fur still shows on a dark badge
  white: '#FFFFFF',
  whiteEdge: '#AEB8BF', // coat and muzzle outline
  pink: '#F2A5B5',
  mouthInside: '#8E3347',
  eye: '#E8B93A',
  pupil: '#111014',
  brow: '#9A94A8',
  whisker: '#D8D4DE',
  gold: '#E3A72F',
  goldEdge: '#9A6B0B',
  book: '#0B6B68',
  page: '#FFF8E6',
  sweat: '#7CC4E8',
  confetti: ['#E3A72F', '#F2A5B5', '#7CC4E8', '#8FD19E'],
} as const;
