/**
 * Side game calculation engine: Skins and Stableford points.
 */

import type {
  SkinsResults,
  SkinsSettings,
  StablefordPointValues,
  StablefordResults,
  StablefordSettings,
} from '@/types';
import { getFoxCreekHoleData } from './handicap';
import { getStrokesOnHole } from './tournament-scoring';

export interface PlayerNetScores {
  playerId: string;
  courseHandicap: number;
  grossByHole: { hole: number; gross: number }[];
}

const DEFAULT_STABLEFORD: StablefordPointValues = {
  eagle: 4,
  birdie: 2,
  par: 0,
  bogey: -1,
  double_bogey: -2,
  worse: -3,
};

function stablefordPointsForScore(
  gross: number,
  par: number,
  strokes: number,
  pointValues: StablefordPointValues
): number {
  const net = gross - strokes;
  const diff = net - par;

  if (diff <= -2) return pointValues.eagle ?? DEFAULT_STABLEFORD.eagle ?? 0;
  if (diff === -1) return pointValues.birdie ?? DEFAULT_STABLEFORD.birdie ?? 0;
  if (diff === 0) return pointValues.par ?? DEFAULT_STABLEFORD.par ?? 0;
  if (diff === 1) return pointValues.bogey ?? DEFAULT_STABLEFORD.bogey ?? 0;
  if (diff === 2) return pointValues.double_bogey ?? DEFAULT_STABLEFORD.double_bogey ?? 0;
  return pointValues.worse ?? DEFAULT_STABLEFORD.worse ?? 0;
}

/**
 * Calculate Stableford points for each player across 18 holes.
 */
export function calculateStablefordResults(
  players: PlayerNetScores[],
  settings: StablefordSettings
): StablefordResults {
  const holeData = getFoxCreekHoleData();
  const pointValues = settings.point_values ?? DEFAULT_STABLEFORD;
  const totals: Record<string, number> = {};
  const holes: StablefordResults['holes'] = [];

  for (const player of players) {
    totals[player.playerId] = 0;
  }

  for (const hole of holeData) {
    const holePoints: Record<string, number> = {};

    for (const player of players) {
      const grossEntry = player.grossByHole.find((h) => h.hole === hole.hole);
      const gross = grossEntry?.gross ?? hole.par;
      const strokes = getStrokesOnHole(player.courseHandicap, hole.handicapIndex);
      const points = stablefordPointsForScore(gross, hole.par, strokes, pointValues);

      holePoints[player.playerId] = points;
      totals[player.playerId] = (totals[player.playerId] ?? 0) + points;
    }

    holes.push({ hole: hole.hole, points: holePoints });
  }

  return { holes, totals };
}

/**
 * Calculate Skins winners and running balances hole-by-hole.
 * Uses net scores; ties carry over when carryover is enabled.
 */
export function calculateSkinsResults(
  players: PlayerNetScores[],
  settings: SkinsSettings
): SkinsResults {
  const holeData = getFoxCreekHoleData();
  const skinValue = settings.value_per_skin ?? 1;
  const balances: Record<string, number> = {};
  const holes: SkinsResults['holes'] = [];
  let carryoverSkins = 0;

  for (const player of players) {
    balances[player.playerId] = 0;
  }

  for (const hole of holeData) {
    const scores: Record<string, number> = {};

    for (const player of players) {
      const grossEntry = player.grossByHole.find((h) => h.hole === hole.hole);
      const gross = grossEntry?.gross ?? hole.par;
      const strokes = getStrokesOnHole(player.courseHandicap, hole.handicapIndex);
      scores[player.playerId] = gross - strokes;
    }

    const lowestNet = Math.min(...Object.values(scores));
    const winnerIds = Object.entries(scores)
      .filter(([, net]) => net === lowestNet)
      .map(([playerId]) => playerId);

    const skinsAtStake = 1 + carryoverSkins;
    let awardedSkins = 0;

    if (winnerIds.length === 1) {
      awardedSkins = skinsAtStake;
      const winnerId = winnerIds[0];
      balances[winnerId] = (balances[winnerId] ?? 0) + awardedSkins * skinValue;
      carryoverSkins = 0;
    } else if (settings.carryover) {
      carryoverSkins = skinsAtStake;
    } else {
      carryoverSkins = 0;
    }

    holes.push({
      hole: hole.hole,
      winner_ids: winnerIds.length === 1 ? winnerIds : [],
      skin_value: awardedSkins * skinValue,
      carryover: carryoverSkins,
      scores,
    });
  }

  return { holes, balances };
}
