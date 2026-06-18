/**
 * Direct Result hole outcome helpers — source of truth is hole_winner, not strokes.
 */

import type {
  TournamentMatchHoleResult,
  TournamentMatchHoleWinner,
  TournamentMatchGroup,
  TournamentScore,
} from '@/types';
import { computeMatchHoleResults } from './tournament-match-scoring';

export type HoleOutcomesMap = Record<number, TournamentMatchHoleWinner | null>;
export type PairingOutcomesMap = Record<number, HoleOutcomesMap>;

export function setHoleOutcome(
  outcomes: HoleOutcomesMap,
  hole: number,
  winner: TournamentMatchHoleWinner
): HoleOutcomesMap {
  return { ...outcomes, [hole]: winner };
}

export function clearHoleOutcome(
  outcomes: HoleOutcomesMap,
  hole: number
): HoleOutcomesMap {
  const next = { ...outcomes };
  delete next[hole];
  return next;
}

export function holeResultsToOutcomes(
  rows: Array<Pick<TournamentMatchHoleResult, 'hole' | 'hole_winner' | 'pairing_index'>>,
  pairingIndex?: number
): HoleOutcomesMap {
  const filtered =
    pairingIndex != null
      ? rows.filter((r) => (r.pairing_index ?? 0) === pairingIndex)
      : rows.filter((r) => (r.pairing_index ?? 0) === 0);

  const map: HoleOutcomesMap = {};
  for (const row of filtered) {
    map[row.hole] = row.hole_winner;
  }
  return map;
}

export function holeResultsToPairingOutcomes(
  rows: TournamentMatchHoleResult[]
): PairingOutcomesMap {
  const map: PairingOutcomesMap = {};
  for (const row of rows) {
    const idx = row.pairing_index ?? 0;
    if (!map[idx]) map[idx] = {};
    map[idx][row.hole] = row.hole_winner;
  }
  return map;
}

export function outcomesToHoleResults(params: {
  matchGroupId: string;
  roundNumber: number;
  outcomes: HoleOutcomesMap;
  pairingIndex?: number;
}): Omit<TournamentMatchHoleResult, 'id'>[] {
  const pairingIndex = params.pairingIndex ?? 0;
  const results: Omit<TournamentMatchHoleResult, 'id'>[] = [];

  for (const [holeStr, winner] of Object.entries(params.outcomes)) {
    if (!winner) continue;
    const hole = Number(holeStr);
    results.push({
      match_group_id: params.matchGroupId,
      round_number: params.roundNumber,
      hole,
      side_a_net: 0,
      side_b_net: 0,
      hole_winner: winner,
      pairing_index: pairingIndex,
    });
  }

  return results.sort((a, b) => a.hole - b.hole);
}

export function allOutcomesToHoleResults(params: {
  matchGroupId: string;
  roundNumber: number;
  holeOutcomes?: HoleOutcomesMap;
  pairingOutcomes?: PairingOutcomesMap;
}): Omit<TournamentMatchHoleResult, 'id'>[] {
  const rows: Omit<TournamentMatchHoleResult, 'id'>[] = [];

  if (params.holeOutcomes) {
    rows.push(
      ...outcomesToHoleResults({
        matchGroupId: params.matchGroupId,
        roundNumber: params.roundNumber,
        outcomes: params.holeOutcomes,
        pairingIndex: 0,
      })
    );
  }

  if (params.pairingOutcomes) {
    for (const [idxStr, outcomes] of Object.entries(params.pairingOutcomes)) {
      rows.push(
        ...outcomesToHoleResults({
          matchGroupId: params.matchGroupId,
          roundNumber: params.roundNumber,
          outcomes,
          pairingIndex: Number(idxStr),
        })
      );
    }
  }

  return rows;
}

export function outcomesMapToHoleResultRows(
  outcomes: HoleOutcomesMap
): Array<Pick<TournamentMatchHoleResult, 'hole' | 'hole_winner'>> {
  return Object.entries(outcomes)
    .filter(([, w]) => w != null)
    .map(([hole, hole_winner]) => ({
      hole: Number(hole),
      hole_winner: hole_winner!,
    }))
    .sort((a, b) => a.hole - b.hole);
}

/** Backfill outcomes from legacy stroke-based scores when no hole results exist. */
export function deriveOutcomesFromLegacyScores(params: {
  matchGroup: TournamentMatchGroup;
  roundNumber: number;
  scores: TournamentScore[];
  useNetScoring?: boolean;
  pairingIndex?: number;
}): HoleOutcomesMap {
  const computed = computeMatchHoleResults(
    params.matchGroup,
    params.roundNumber,
    params.matchGroup.format,
    params.scores,
    { useNetScoring: params.useNetScoring ?? false }
  );

  const pairingIndex = params.pairingIndex ?? 0;
  const map: HoleOutcomesMap = {};
  for (const row of computed) {
    if ((row as { pairing_index?: number }).pairing_index != null) {
      if ((row as { pairing_index?: number }).pairing_index !== pairingIndex) continue;
    }
    map[row.hole] = row.hole_winner;
  }
  return map;
}

export function getSinglesPairingCount(matchGroup: TournamentMatchGroup): number {
  return Math.min(
    matchGroup.side_a_player_ids.length,
    matchGroup.side_b_player_ids.length
  );
}

export function mergeOutcomesWithSaved(
  local: HoleOutcomesMap,
  saved: HoleOutcomesMap
): HoleOutcomesMap {
  return { ...saved, ...local };
}
