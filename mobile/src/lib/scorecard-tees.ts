import type { ScorecardTeeDefinition, ScorecardTeeName, ScorecardYardageRow } from '@/types';

/** Official tee colors matching the printed Fox Creek scorecard. */
export const TEE_COLORS = {
  black: '#1a1a1a',
  blue: '#2563eb',
  white: '#e5e5e5',
  green: '#16a34a',
  red: '#dc2626',
} as const;

/** All playable tees including combo options (for player tee selection). */
export const SCORECARD_TEES: ScorecardTeeDefinition[] = [
  {
    id: 'Black',
    ratingName: 'Black',
    yardageKey: 'black',
    colors: [TEE_COLORS.black],
    isCombo: false,
    shortLabel: 'Black',
  },
  {
    id: 'Blue',
    ratingName: 'Blue',
    yardageKey: 'blue',
    colors: [TEE_COLORS.blue],
    isCombo: false,
    shortLabel: 'Blue',
  },
  {
    id: 'Blue/White',
    ratingName: 'Blue/White',
    yardageKey: 'white1',
    colors: [TEE_COLORS.blue, TEE_COLORS.white],
    isCombo: true,
    shortLabel: 'Blue/White',
  },
  {
    id: 'White',
    ratingName: 'White',
    yardageKey: 'white2',
    colors: [TEE_COLORS.white],
    isCombo: false,
    shortLabel: 'White',
  },
  {
    id: 'White/Green',
    ratingName: 'White/Green',
    yardageKey: 'whiteGreen',
    colors: [TEE_COLORS.white, TEE_COLORS.green],
    isCombo: true,
    shortLabel: 'White/Green',
  },
  {
    id: 'Green',
    ratingName: 'Green',
    yardageKey: 'greenMens',
    colors: [TEE_COLORS.green],
    isCombo: false,
    shortLabel: 'Green',
  },
  {
    id: 'Green/Red',
    ratingName: 'Green/Red',
    yardageKey: 'red1',
    colors: [TEE_COLORS.green, TEE_COLORS.red],
    isCombo: true,
    shortLabel: 'Green/Red',
  },
  {
    id: 'Red',
    ratingName: 'Red',
    yardageKey: 'red2',
    colors: [TEE_COLORS.red],
    isCombo: false,
    shortLabel: 'Red',
  },
];

/** Men's yardage rows on the scorecard (order matches physical card). */
export const MENS_YARDAGE_ROWS: ScorecardYardageRow[] = [
  {
    yardageKey: 'black',
    ratingName: 'Black',
    colors: [TEE_COLORS.black],
    isCombo: false,
    section: 'mens',
  },
  {
    yardageKey: 'blue',
    ratingName: 'Blue',
    colors: [TEE_COLORS.blue],
    isCombo: false,
    section: 'mens',
  },
  {
    yardageKey: 'white1',
    ratingName: 'Blue/White',
    colors: [TEE_COLORS.blue, TEE_COLORS.white],
    isCombo: true,
    section: 'mens',
  },
  {
    yardageKey: 'white2',
    ratingName: 'White',
    colors: [TEE_COLORS.white],
    isCombo: false,
    section: 'mens',
  },
  {
    yardageKey: 'whiteGreen',
    ratingName: 'White/Green',
    colors: [TEE_COLORS.white, TEE_COLORS.green],
    isCombo: true,
    section: 'mens',
  },
  {
    yardageKey: 'greenMens',
    ratingName: 'Green',
    colors: [TEE_COLORS.green],
    isCombo: false,
    section: 'mens',
  },
];

/** Ladies yardage rows (Green/Red combo uses the red1 column on the card). */
export const LADIES_YARDAGE_ROWS: ScorecardYardageRow[] = [
  {
    yardageKey: 'greenLadies',
    ratingName: 'Green',
    colors: [TEE_COLORS.green],
    isCombo: false,
    section: 'ladies',
  },
  {
    yardageKey: 'red1',
    ratingName: 'Green/Red',
    colors: [TEE_COLORS.green, TEE_COLORS.red],
    isCombo: true,
    section: 'ladies',
  },
  {
    yardageKey: 'red2',
    ratingName: 'Red',
    colors: [TEE_COLORS.red],
    isCombo: false,
    section: 'ladies',
  },
];

export function getScorecardTee(id: ScorecardTeeName): ScorecardTeeDefinition | undefined {
  return SCORECARD_TEES.find((t) => t.id === id);
}

export function textColorForTeeColors(colors: readonly string[]): string {
  const light = colors.some((c) => c === TEE_COLORS.white);
  return light && colors.length === 1 ? '#2C2416' : '#fff';
}

/** Map combo tee to a solid tee for DB fields that only accept TeeName. */
export function scorecardTeeToDbTee(tee: ScorecardTeeName): import('@/types').TeeName {
  switch (tee) {
    case 'Blue/White':
      return 'White';
    case 'White/Green':
      return 'Green';
    case 'Green/Red':
      return 'Red';
    default:
      return tee;
  }
}
