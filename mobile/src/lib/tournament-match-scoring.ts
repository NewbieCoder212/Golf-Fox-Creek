/**
 * Compute 2v2 match hole winners and Ryder-Cup match points from saved scorecards.
 */

import type {
  TournamentFormat,
  TournamentHoleScore,
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentScore,
  TournamentTeamSide,
} from '@/types';
import { FOX_CREEK_DATA } from './course-data';
import { resolveHoleWinner } from './tournament-match-service';
import { isSinglesFormat } from './tournament-labels';

function holeNetFromScorecard(
  holeScores: TournamentHoleScore[],
  hole: number
): number | null {
  const row = holeScores.find((h) => h.hole === hole);
  return row?.net ?? null;
}

function bestNetForPlayers(
  playerIds: string[],
  scores: TournamentScore[],
  hole: number
): number | null {
  const nets = playerIds
    .map((playerId) => {
      const card = scores.find(
        (s) => s.user_id === playerId || s.tournament_player_id === playerId
      );
      return card ? holeNetFromScorecard(card.hole_scores, hole) : null;
    })
    .filter((net): net is number => net !== null);

  if (nets.length === 0) return null;
  return Math.min(...nets);
}

function playerNetForHole(
  playerId: string,
  scores: TournamentScore[],
  hole: number
): number | null {
  const card = scores.find(
    (s) => s.user_id === playerId || s.tournament_player_id === playerId
  );
  if (!card) return null;
  return holeNetFromScorecard(card.hole_scores, hole);
}

function teamNetForSide(
  teamId: string,
  scores: TournamentScore[],
  hole: number
): number | null {
  const card = scores.find((s) => s.team_id === teamId);
  if (!card) return null;
  return holeNetFromScorecard(card.hole_scores, hole);
}

const HOLES = FOX_CREEK_DATA.holeData.map((h) => h.holeNumber);

export function computeMatchHoleResults(
  matchGroup: TournamentMatchGroup,
  roundNumber: number,
  format: TournamentFormat,
  scores: TournamentScore[]
): Omit<TournamentMatchHoleResult, 'id'>[] {
  const results: Omit<TournamentMatchHoleResult, 'id'>[] = [];

  for (const hole of HOLES) {
    let sideANet: number | null;
    let sideBNet: number | null;

    if (isSinglesFormat(format)) {
      sideANet = bestNetForPlayers(matchGroup.side_a_player_ids, scores, hole);
      sideBNet = bestNetForPlayers(matchGroup.side_b_player_ids, scores, hole);
    } else {
      sideANet = teamNetForSide(matchGroup.side_a_team_id, scores, hole);
      sideBNet = teamNetForSide(matchGroup.side_b_team_id, scores, hole);
    }

    if (sideANet === null || sideBNet === null) continue;

    results.push({
      match_group_id: matchGroup.id,
      round_number: roundNumber,
      hole,
      side_a_net: sideANet,
      side_b_net: sideBNet,
      hole_winner: resolveHoleWinner(sideANet, sideBNet),
    });
  }

  return results;
}

export function countMatchHoleWinsFromResults(results: TournamentMatchHoleResult[]): {
  side_a: number;
  side_b: number;
  ties: number;
} {
  return results.reduce(
    (acc, row) => {
      if (row.hole_winner === 'side_a') acc.side_a += 1;
      else if (row.hole_winner === 'side_b') acc.side_b += 1;
      else acc.ties += 1;
      return acc;
    },
    { side_a: 0, side_b: 0, ties: 0 }
  );
}

export function aggregateEventHoleWins(
  results: TournamentMatchHoleResult[]
): { side_a: number; side_b: number; ties: number } {
  return countMatchHoleWinsFromResults(results);
}

function subMatchHoleWins(
  playerAId: string,
  playerBId: string,
  scores: TournamentScore[]
): { side_a: number; side_b: number } {
  let side_a = 0;
  let side_b = 0;

  for (const hole of HOLES) {
    const netA = playerNetForHole(playerAId, scores, hole);
    const netB = playerNetForHole(playerBId, scores, hole);
    if (netA === null || netB === null) continue;
    const winner = resolveHoleWinner(netA, netB);
    if (winner === 'side_a') side_a += 1;
    else if (winner === 'side_b') side_b += 1;
  }

  return { side_a, side_b };
}

function pointsFromWinTally(aWins: number, bWins: number): {
  match_winner: TournamentTeamSide | 'tie';
  match_points_a: number;
  match_points_b: number;
} {
  if (aWins > bWins) {
    return { match_winner: 'side_a', match_points_a: 1, match_points_b: 0 };
  }
  if (bWins > aWins) {
    return { match_winner: 'side_b', match_points_a: 0, match_points_b: 1 };
  }
  return { match_winner: 'tie', match_points_a: 0.5, match_points_b: 0.5 };
}

export function computeMatchPoints(params: {
  matchGroup: TournamentMatchGroup;
  format: TournamentFormat;
  scores: TournamentScore[];
  holeResults: TournamentMatchHoleResult[];
}): {
  match_winner: TournamentTeamSide | 'tie';
  match_points_a: number;
  match_points_b: number;
} {
  const { matchGroup, format, scores, holeResults } = params;

  if (isSinglesFormat(format)) {
    const pairCount = Math.min(
      matchGroup.side_a_player_ids.length,
      matchGroup.side_b_player_ids.length
    );

    let totalA = 0;
    let totalB = 0;

    for (let i = 0; i < pairCount; i++) {
      const wins = subMatchHoleWins(
        matchGroup.side_a_player_ids[i],
        matchGroup.side_b_player_ids[i],
        scores
      );
      const pairPoints = pointsFromWinTally(wins.side_a, wins.side_b);
      totalA += pairPoints.match_points_a;
      totalB += pairPoints.match_points_b;
    }

    if (totalA > totalB) {
      return { match_winner: 'side_a', match_points_a: totalA, match_points_b: totalB };
    }
    if (totalB > totalA) {
      return { match_winner: 'side_b', match_points_a: totalA, match_points_b: totalB };
    }
    return { match_winner: 'tie', match_points_a: totalA, match_points_b: totalB };
  }

  const wins = countMatchHoleWinsFromResults(holeResults);
  return pointsFromWinTally(wins.side_a, wins.side_b);
}
