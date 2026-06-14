/**
 * WHS (World Handicap System) Calculation Utilities
 *
 * Implements official WHS handicap calculation including:
 * - Score differential calculation
 * - ESC (Equitable Stroke Control) adjusted score
 * - Handicap index from best differentials
 */

import type { HoleScore, TeeName } from '@/types';
import { FOX_CREEK_DATA, getTeeRating } from './course-data';

// ============================================
// CONSTANTS
// ============================================

// Maximum handicap index per WHS rules
const MAX_HANDICAP_INDEX = 54.0;

// WHS differential selection table
// [rounds played]: number of differentials to use
const DIFFERENTIAL_SELECTION: Record<number, { count: number; adjustment: number }> = {
  3: { count: 1, adjustment: -2.0 },
  4: { count: 1, adjustment: -1.0 },
  5: { count: 1, adjustment: 0 },
  6: { count: 2, adjustment: -1.0 },
  7: { count: 2, adjustment: 0 },
  8: { count: 2, adjustment: 0 },
  9: { count: 3, adjustment: 0 },
  10: { count: 3, adjustment: 0 },
  11: { count: 3, adjustment: 0 },
  12: { count: 4, adjustment: 0 },
  13: { count: 4, adjustment: 0 },
  14: { count: 4, adjustment: 0 },
  15: { count: 5, adjustment: 0 },
  16: { count: 5, adjustment: 0 },
  17: { count: 6, adjustment: 0 },
  18: { count: 6, adjustment: 0 },
  19: { count: 7, adjustment: 0 },
  20: { count: 8, adjustment: 0 },
};

// ============================================
// SCORE DIFFERENTIAL CALCULATION
// ============================================

/**
 * Calculate score differential using WHS formula
 * Differential = (113 / Slope Rating) × (Adjusted Gross Score - Course Rating)
 */
export function calculateDifferential(
  adjustedScore: number,
  courseRating: number,
  slopeRating: number
): number {
  const differential = (113 / slopeRating) * (adjustedScore - courseRating);
  return Math.round(differential * 10) / 10; // Round to 1 decimal
}

// ============================================
// ESC (EQUITABLE STROKE CONTROL)
// ============================================

/**
 * Get maximum score per hole based on course handicap
 * WHS uses "net double bogey" as the maximum
 */
export function getMaxScoreForHole(par: number, courseHandicap: number, holeHandicapIndex: number): number {
  // Determine if player gets stroke(s) on this hole
  const strokesReceived = Math.floor(courseHandicap / 18) + (holeHandicapIndex <= (courseHandicap % 18) ? 1 : 0);

  // Max score = par + 2 (double bogey) + strokes received
  return par + 2 + strokesReceived;
}

/**
 * Calculate ESC adjusted score for handicap purposes
 * Uses "net double bogey" method per WHS rules
 */
export function calculateAdjustedScore(
  scores: HoleScore[],
  courseHandicap: number,
  holeData: { hole: number; par: number; handicapIndex: number }[]
): number {
  let adjustedTotal = 0;

  for (const holeScore of scores) {
    if (holeScore.score === null) continue;

    const holeInfo = holeData.find((h) => h.hole === holeScore.hole);
    if (!holeInfo) {
      adjustedTotal += holeScore.score;
      continue;
    }

    const maxScore = getMaxScoreForHole(holeInfo.par, courseHandicap, holeInfo.handicapIndex);
    adjustedTotal += Math.min(holeScore.score, maxScore);
  }

  return adjustedTotal;
}

/**
 * Simple ESC calculation when course handicap is unknown
 * Uses basic max double bogey per hole
 */
export function calculateSimpleAdjustedScore(scores: HoleScore[]): number {
  let adjustedTotal = 0;

  for (const holeScore of scores) {
    if (holeScore.score === null) continue;
    // Max score = par + 2 (double bogey)
    const maxScore = holeScore.par + 2;
    adjustedTotal += Math.min(holeScore.score, maxScore);
  }

  return adjustedTotal;
}

// ============================================
// COURSE HANDICAP CALCULATION
// ============================================

/**
 * Calculate course handicap from handicap index
 * Course Handicap = Handicap Index × (Slope Rating / 113) + (Course Rating - Par)
 */
export function calculateCourseHandicap(
  handicapIndex: number,
  slopeRating: number,
  courseRating: number,
  par: number
): number {
  const courseHandicap = handicapIndex * (slopeRating / 113) + (courseRating - par);
  return Math.round(courseHandicap);
}

// ============================================
// HANDICAP INDEX CALCULATION
// ============================================

/**
 * Calculate handicap index from differentials (WHS method)
 * Uses best N differentials based on number of rounds played
 */
export function calculateHandicapIndex(differentials: number[]): number | null {
  const count = differentials.length;

  // Minimum 3 rounds required
  if (count < 3) {
    return null;
  }

  // Sort differentials ascending (lowest/best first)
  const sorted = [...differentials].sort((a, b) => a - b);

  // Get selection parameters (cap at 20 rounds)
  const roundsToUse = Math.min(count, 20);
  const selection = DIFFERENTIAL_SELECTION[roundsToUse] || { count: 8, adjustment: 0 };

  // Take best N differentials
  const bestDifferentials = sorted.slice(0, selection.count);

  // Calculate average
  const average = bestDifferentials.reduce((sum, d) => sum + d, 0) / selection.count;

  // Apply adjustment and round to 1 decimal
  let handicapIndex = Math.round((average + selection.adjustment) * 10) / 10;

  // Apply limits (0 to 54.0)
  handicapIndex = Math.max(0, Math.min(MAX_HANDICAP_INDEX, handicapIndex));

  return handicapIndex;
}

// ============================================
// FOX CREEK SPECIFIC HELPERS
// ============================================

/**
 * Get course rating and slope for Fox Creek by tee
 */
export function getFoxCreekRatings(
  teeName: TeeName,
  gender: 'mens' | 'womens' = 'mens'
): { courseRating: number; slopeRating: number } | null {
  const tee = getTeeRating(teeName);
  if (!tee) return null;

  return {
    courseRating: gender === 'mens' ? tee.mensRating : tee.womensRating,
    slopeRating: gender === 'mens' ? tee.mensSlope : tee.womensSlope,
  };
}

/**
 * Get hole data for Fox Creek (par and handicap index)
 */
export function getFoxCreekHoleData(): { hole: number; par: number; handicapIndex: number }[] {
  return FOX_CREEK_DATA.holeData.map((h) => ({
    hole: h.holeNumber,
    par: h.par,
    handicapIndex: h.handicapIndex,
  }));
}

/**
 * Prepare a round for database submission
 */
export function prepareRoundForSubmission(params: {
  userId: string;
  scores: HoleScore[];
  teePlayed: TeeName;
  gender?: 'mens' | 'womens';
  durationSeconds?: number;
  weatherConditions?: string;
}): {
  user_id: string;
  tee_played: TeeName;
  gross_score: number;
  adjusted_score: number;
  course_rating: number;
  slope_rating: number;
  differential: number;
  scores: HoleScore[];
  duration_seconds?: number;
  weather_conditions?: string;
} | null {
  const { userId, scores, teePlayed, gender = 'mens', durationSeconds, weatherConditions } = params;

  // Get ratings for tee played
  const ratings = getFoxCreekRatings(teePlayed, gender);
  if (!ratings) {
    console.log('[Handicap] Could not get ratings for tee:', teePlayed);
    return null;
  }

  // Calculate gross score
  const grossScore = scores.reduce((sum, h) => sum + (h.score ?? 0), 0);

  // Calculate adjusted score (simple ESC - double bogey max)
  const adjustedScore = calculateSimpleAdjustedScore(scores);

  // Calculate differential
  const differential = calculateDifferential(
    adjustedScore,
    ratings.courseRating,
    ratings.slopeRating
  );

  return {
    user_id: userId,
    tee_played: teePlayed,
    gross_score: grossScore,
    adjusted_score: adjustedScore,
    course_rating: ratings.courseRating,
    slope_rating: ratings.slopeRating,
    differential,
    scores,
    duration_seconds: durationSeconds,
    weather_conditions: weatherConditions,
  };
}
