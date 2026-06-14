/**
 * Compute 2v2 match hole winners from saved scorecards.
 */

import type {
  TournamentFormat,
  TournamentHoleScore,
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentScore,
} from '@/types';
import { FOX_CREEK_DATA } from './course-data';
import { resolveHoleWinner } from './tournament-match-service';

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

function teamNetForSide(
  teamId: string,
  scores: TournamentScore[],
  hole: number
): number | null {
  const card = scores.find((s) => s.team_id === teamId);
  if (!card) return null;
  return holeNetFromScorecard(card.hole_scores, hole);
}

export function computeMatchHoleResults(
  matchGroup: TournamentMatchGroup,
  roundNumber: number,
  format: TournamentFormat,
  scores: TournamentScore[]
): Omit<TournamentMatchHoleResult, 'id'>[] {
  const results: Omit<TournamentMatchHoleResult, 'id'>[] = [];

  for (const hole of FOX_CREEK_DATA.holeData.map((h) => h.holeNumber)) {
    let sideANet: number | null;
    let sideBNet: number | null;

    if (format === 'singles') {
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

export function aggregateEventHoleWins(
  results: TournamentMatchHoleResult[]
): { side_a: number; side_b: number; ties: number } {
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
