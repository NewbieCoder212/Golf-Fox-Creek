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
  TeeName,
} from '@/types';
import { FOX_CREEK_DATA } from './course-data';
import { resolveHoleWinner } from './tournament-match-service';
import { isSinglesFormat } from './tournament-labels';
import {
  buildTournamentHoleScores,
  sumHoleScores,
  type PlayerGrossScores,
} from './tournament-scoring';

function findPlayerScorecard(
  playerId: string,
  scores: TournamentScore[]
): TournamentScore | undefined {
  return scores.find(
    (s) => s.user_id === playerId || s.tournament_player_id === playerId
  );
}

function playerHasEnteredHole(card: TournamentScore, hole: number): boolean {
  const row = card.hole_scores.find((h) => h.hole === hole);
  if (!row) return false;
  if (row.entered === true) return true;
  // Sparse scorecards only store holes the player actually scored.
  if (card.hole_scores.length < 18) return true;
  return false;
}

function holeNetFromScorecard(
  card: TournamentScore,
  hole: number
): number | null {
  if (!playerHasEnteredHole(card, hole)) return null;
  const row = card.hole_scores.find((h) => h.hole === hole);
  if (!row) return null;
  if (row.entered === false) return null;
  return row.net ?? null;
}

function playerGrossForHole(
  playerId: string,
  scores: TournamentScore[],
  hole: number
): { gross: number; entered?: boolean } | null {
  const card = findPlayerScorecard(playerId, scores);
  if (!card || !playerHasEnteredHole(card, hole)) return null;
  const row = card.hole_scores.find((h) => h.hole === hole);
  if (!row) return null;
  return { gross: row.gross, entered: row.entered };
}

function sideHasEnteredScoreOnHole(
  playerIds: string[],
  scores: TournamentScore[],
  hole: number
): boolean {
  return playerIds.some((playerId) => {
    const card = findPlayerScorecard(playerId, scores);
    return card ? playerHasEnteredHole(card, hole) : false;
  });
}

/** Ignore par-filled placeholder holes from legacy sync payloads. */
function isHolePlayedForMatch(
  hole: number,
  matchGroup: TournamentMatchGroup,
  scores: TournamentScore[]
): boolean {
  const sideA = matchGroup.side_a_player_ids;
  const sideB = matchGroup.side_b_player_ids;

  if (!sideHasEnteredScoreOnHole(sideA, scores, hole)) return false;
  if (!sideHasEnteredScoreOnHole(sideB, scores, hole)) return false;

  const par = FOX_CREEK_DATA.holeData.find((h) => h.holeNumber === hole)?.par;
  if (par == null) return false;

  const playerIds = [...sideA, ...sideB];
  const entries = playerIds
    .map((id) => playerGrossForHole(id, scores, hole))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (entries.length === 0) return false;

  const cards = playerIds
    .map((id) => findPlayerScorecard(id, scores))
    .filter((card): card is TournamentScore => Boolean(card));

  const allFullLegacyCards =
    cards.length === playerIds.length &&
    cards.every((card) => card.hole_scores.length === 18) &&
    entries.every((entry) => entry.entered !== true);

  if (
    allFullLegacyCards &&
    entries.length === playerIds.length &&
    entries.every((entry) => entry.gross === par)
  ) {
    return false;
  }

  return true;
}

function bestNetForPlayers(
  playerIds: string[],
  scores: TournamentScore[],
  hole: number
): number | null {
  const nets = playerIds
    .map((playerId) => {
      const card = findPlayerScorecard(playerId, scores);
      return card ? holeNetFromScorecard(card, hole) : null;
    })
    .filter((net): net is number => net !== null);

  if (nets.length === 0) return null;
  return Math.min(...nets);
}

function holeGrossFromScorecard(card: TournamentScore, hole: number): number | null {
  if (!playerHasEnteredHole(card, hole)) return null;
  const row = card.hole_scores.find((h) => h.hole === hole);
  if (!row) return null;
  return row.gross ?? null;
}

function bestGrossForPlayers(
  playerIds: string[],
  scores: TournamentScore[],
  hole: number
): number | null {
  const grosses = playerIds
    .map((playerId) => {
      const card = findPlayerScorecard(playerId, scores);
      return card ? holeGrossFromScorecard(card, hole) : null;
    })
    .filter((gross): gross is number => gross !== null);

  if (grosses.length === 0) return null;
  return Math.min(...grosses);
}

function playerGrossForHoleScore(
  playerId: string,
  scores: TournamentScore[],
  hole: number
): number | null {
  const card = findPlayerScorecard(playerId, scores);
  if (!card) return null;
  return holeGrossFromScorecard(card, hole);
}

function playerNetForHole(
  playerId: string,
  scores: TournamentScore[],
  hole: number
): number | null {
  const card = findPlayerScorecard(playerId, scores);
  if (!card) return null;
  return holeNetFromScorecard(card, hole);
}

function teamNetForSide(
  teamId: string,
  scores: TournamentScore[],
  hole: number
): number | null {
  const card = scores.find((s) => s.team_id === teamId);
  if (!card) return null;
  return holeNetFromScorecard(card, hole);
}

function teamGrossForSide(
  teamId: string,
  scores: TournamentScore[],
  hole: number
): number | null {
  const card = scores.find((s) => s.team_id === teamId);
  if (!card) return null;
  return holeGrossFromScorecard(card, hole);
}

const HOLES = FOX_CREEK_DATA.holeData.map((h) => h.holeNumber);

function asLiveScore(
  matchGroup: TournamentMatchGroup,
  holeScores: TournamentHoleScore[],
  ids: {
    team_id?: string | null;
    user_id?: string | null;
    tournament_player_id?: string | null;
  }
): TournamentScore {
  const totals = sumHoleScores(holeScores);
  return {
    id: `live-${ids.tournament_player_id ?? ids.team_id ?? ids.user_id ?? 'x'}`,
    tournament_id: matchGroup.tournament_id,
    match_group_id: matchGroup.id,
    round_number: matchGroup.round_number,
    team_id: ids.team_id ?? null,
    user_id: ids.user_id ?? null,
    tournament_player_id: ids.tournament_player_id ?? null,
    hole_scores: holeScores,
    total_gross: totals.total_gross,
    total_net: totals.total_net,
    created_at: '',
  };
}

/** Build in-memory scorecards from local gross entry for live match status. */
export function buildLiveMatchScores(params: {
  matchGroup: TournamentMatchGroup;
  format: TournamentFormat;
  players: Array<{
    id: string;
    handicapIndex: number;
    playingHandicap: number;
    tournamentPlayerId?: string | null;
    teamId?: string | null;
  }>;
  grossScores: Record<string, Record<number, number>>;
  teamGrossScores: Record<number, number>;
  teePlayed?: TeeName;
}): TournamentScore[] {
  const { matchGroup, format, players, grossScores, teamGrossScores, teePlayed = 'White' } =
    params;

  const playerGrossScores: PlayerGrossScores[] = players.map((player) => ({
    playerId: player.id,
    handicapIndex: player.handicapIndex,
    playingHandicap: player.playingHandicap,
    holes: Object.entries(grossScores[player.id] ?? {}).map(([hole, gross]) => ({
      hole: Number(hole),
      gross,
    })),
  }));

  if (format === 'best_ball' || isSinglesFormat(format)) {
    return players.map((player) => {
      const holeScores = buildTournamentHoleScores({
        format: 'singles',
        grossByHole:
          playerGrossScores.find((p) => p.playerId === player.id)?.holes ?? [],
        handicapIndex: player.handicapIndex,
        teePlayed,
        includeUnplayedHoles: false,
      });
      return asLiveScore(matchGroup, holeScores, {
        tournament_player_id: player.tournamentPlayerId ?? player.id,
        user_id: player.tournamentPlayerId ? null : player.id,
      });
    });
  }

  const teamIds = new Set(players.map((p) => p.teamId).filter(Boolean) as string[]);
  const scores: TournamentScore[] = [];

  for (const teamId of teamIds) {
    const teamPlayers = players.filter((p) => p.teamId === teamId);
    const holeScores = buildTournamentHoleScores({
      format,
      grossByHole: Object.entries(teamGrossScores).map(([hole, gross]) => ({
        hole: Number(hole),
        gross,
      })),
      players: playerGrossScores.filter((p) =>
        teamPlayers.some((tp) => tp.id === p.playerId)
      ),
      teePlayed,
    });
    scores.push(asLiveScore(matchGroup, holeScores, { team_id: teamId }));
  }

  return scores;
}

function scoreIdentity(score: TournamentScore): string {
  return score.tournament_player_id ?? score.team_id ?? score.user_id ?? score.id;
}

/** Prefer live foursome entry; fill gaps from synced DB scorecards. */
export function mergeMatchScoresForStatus(
  saved: TournamentScore[],
  live: TournamentScore[]
): TournamentScore[] {
  const merged = new Map<string, TournamentScore>();
  for (const row of saved) {
    merged.set(scoreIdentity(row), row);
  }
  for (const row of live) {
    merged.set(scoreIdentity(row), row);
  }
  return Array.from(merged.values());
}

export function computeMatchHoleResults(
  matchGroup: TournamentMatchGroup,
  roundNumber: number,
  format: TournamentFormat,
  scores: TournamentScore[],
  options: { useNetScoring?: boolean } = {}
): Omit<TournamentMatchHoleResult, 'id'>[] {
  const useNetScoring = options.useNetScoring ?? false;
  const results: Omit<TournamentMatchHoleResult, 'id'>[] = [];

  for (const hole of HOLES) {
    if (!isHolePlayedForMatch(hole, matchGroup, scores)) continue;

    let sideAValue: number | null;
    let sideBValue: number | null;

    if (isSinglesFormat(format)) {
      const pairCount = Math.min(
        matchGroup.side_a_player_ids.length,
        matchGroup.side_b_player_ids.length
      );
      let subAWins = 0;
      let subBWins = 0;
      let anyPlayed = false;

      for (let i = 0; i < pairCount; i++) {
        const playerAId = matchGroup.side_a_player_ids[i];
        const playerBId = matchGroup.side_b_player_ids[i];
        const valueA = useNetScoring
          ? playerNetForHole(playerAId, scores, hole)
          : playerGrossForHoleScore(playerAId, scores, hole);
        const valueB = useNetScoring
          ? playerNetForHole(playerBId, scores, hole)
          : playerGrossForHoleScore(playerBId, scores, hole);
        if (valueA === null || valueB === null) continue;

        anyPlayed = true;
        const winner = resolveHoleWinner(valueA, valueB);
        if (winner === 'side_a') subAWins += 1;
        else if (winner === 'side_b') subBWins += 1;
      }

      if (!anyPlayed) continue;
      sideAValue = subAWins;
      sideBValue = subBWins;
    } else if (format === 'best_ball') {
      sideAValue = useNetScoring
        ? bestNetForPlayers(matchGroup.side_a_player_ids, scores, hole)
        : bestGrossForPlayers(matchGroup.side_a_player_ids, scores, hole);
      sideBValue = useNetScoring
        ? bestNetForPlayers(matchGroup.side_b_player_ids, scores, hole)
        : bestGrossForPlayers(matchGroup.side_b_player_ids, scores, hole);
    } else {
      sideAValue = useNetScoring
        ? teamNetForSide(matchGroup.side_a_team_id, scores, hole)
        : teamGrossForSide(matchGroup.side_a_team_id, scores, hole);
      sideBValue = useNetScoring
        ? teamNetForSide(matchGroup.side_b_team_id, scores, hole)
        : teamGrossForSide(matchGroup.side_b_team_id, scores, hole);
    }

    if (sideAValue === null || sideBValue === null) continue;

    results.push({
      match_group_id: matchGroup.id,
      round_number: roundNumber,
      hole,
      side_a_net: sideAValue,
      side_b_net: sideBValue,
      hole_winner: resolveHoleWinner(sideAValue, sideBValue),
    });
  }

  return results;
}

/** Head-to-head hole results for one singles pairing within a foursome. */
export function computeSinglesPairHoleResults(
  matchGroup: TournamentMatchGroup,
  roundNumber: number,
  playerAId: string,
  playerBId: string,
  scores: TournamentScore[],
  useNetScoring: boolean
): Omit<TournamentMatchHoleResult, 'id'>[] {
  const results: Omit<TournamentMatchHoleResult, 'id'>[] = [];

  for (const hole of HOLES) {
    const valueA = useNetScoring
      ? playerNetForHole(playerAId, scores, hole)
      : playerGrossForHoleScore(playerAId, scores, hole);
    const valueB = useNetScoring
      ? playerNetForHole(playerBId, scores, hole)
      : playerGrossForHoleScore(playerBId, scores, hole);
    if (valueA === null || valueB === null) continue;

    results.push({
      match_group_id: matchGroup.id,
      round_number: roundNumber,
      hole,
      side_a_net: valueA,
      side_b_net: valueB,
      hole_winner: resolveHoleWinner(valueA, valueB),
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
  scores: TournamentScore[],
  useNetScoring: boolean
): { side_a: number; side_b: number } {
  let side_a = 0;
  let side_b = 0;

  for (const hole of HOLES) {
    const valueA = useNetScoring
      ? playerNetForHole(playerAId, scores, hole)
      : playerGrossForHoleScore(playerAId, scores, hole);
    const valueB = useNetScoring
      ? playerNetForHole(playerBId, scores, hole)
      : playerGrossForHoleScore(playerBId, scores, hole);
    if (valueA === null || valueB === null) continue;
    const winner = resolveHoleWinner(valueA, valueB);
    if (winner === 'side_a') side_a += 1;
    else if (winner === 'side_b') side_b += 1;
  }

  return { side_a, side_b };
}

export const TOURNAMENT_MATCH_HOLES = HOLES;

export function getPlayerHoleScoreValue(
  playerId: string,
  scores: TournamentScore[],
  hole: number,
  useNetScoring: boolean
): number | null {
  return useNetScoring
    ? playerNetForHole(playerId, scores, hole)
    : playerGrossForHoleScore(playerId, scores, hole);
}

export function getSideBestBallHoleScore(
  playerIds: string[],
  scores: TournamentScore[],
  hole: number,
  useNetScoring: boolean
): number | null {
  return useNetScoring
    ? bestNetForPlayers(playerIds, scores, hole)
    : bestGrossForPlayers(playerIds, scores, hole);
}

export function getTeamSideHoleScore(
  teamId: string,
  scores: TournamentScore[],
  hole: number,
  useNetScoring: boolean
): number | null {
  return useNetScoring
    ? teamNetForSide(teamId, scores, hole)
    : teamGrossForSide(teamId, scores, hole);
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

/** Cup points when a manager declares the match result without hole-by-hole entry. */
export function matchPointsForDeclaredWinner(
  winner: TournamentTeamSide | 'tie'
): {
  match_winner: TournamentTeamSide | 'tie';
  match_points_a: number;
  match_points_b: number;
} {
  if (winner === 'side_a') {
    return { match_winner: 'side_a', match_points_a: 1, match_points_b: 0 };
  }
  if (winner === 'side_b') {
    return { match_winner: 'side_b', match_points_a: 0, match_points_b: 1 };
  }
  return { match_winner: 'tie', match_points_a: 0.5, match_points_b: 0.5 };
}

export function computeMatchPoints(params: {
  matchGroup: TournamentMatchGroup;
  format: TournamentFormat;
  scores: TournamentScore[];
  holeResults: TournamentMatchHoleResult[];
  useNetScoring?: boolean;
}): {
  match_winner: TournamentTeamSide | 'tie';
  match_points_a: number;
  match_points_b: number;
} {
  const { matchGroup, format, scores, holeResults, useNetScoring = false } = params;

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
        scores,
        useNetScoring
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

/** Compute cup points from direct hole_winner results (no strokes). */
export function computeMatchPointsFromHoleResults(params: {
  matchGroup: TournamentMatchGroup;
  format: TournamentFormat;
  holeResults: Array<Pick<TournamentMatchHoleResult, 'hole' | 'hole_winner' | 'pairing_index'>>;
}): {
  match_winner: TournamentTeamSide | 'tie';
  match_points_a: number;
  match_points_b: number;
} {
  const { matchGroup, format, holeResults } = params;

  if (isSinglesFormat(format)) {
    const pairCount = Math.min(
      matchGroup.side_a_player_ids.length,
      matchGroup.side_b_player_ids.length
    );

    let totalA = 0;
    let totalB = 0;

    for (let i = 0; i < pairCount; i++) {
      const pairingRows = holeResults.filter((r) => (r.pairing_index ?? 0) === i);
      const wins = countMatchHoleWinsFromResults(
        pairingRows as TournamentMatchHoleResult[]
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

  const teamRows = holeResults.filter((r) => (r.pairing_index ?? 0) === 0);
  const wins = countMatchHoleWinsFromResults(teamRows as TournamentMatchHoleResult[]);
  return pointsFromWinTally(wins.side_a, wins.side_b);
}
