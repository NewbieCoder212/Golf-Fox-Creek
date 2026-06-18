/**
 * Build per-match hole grids for live standings (scores + running match status).
 */

import type {
  TournamentFormat,
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentMatchHoleWinner,
  TournamentScore,
  TournamentTeamSide,
} from '@/types';
import { isSinglesFormat, formatLabel } from './tournament-labels';
import {
  computeMatchHoleResults,
  computeSinglesPairHoleResults,
  getPlayerHoleScoreValue,
  getSideBestBallHoleScore,
  getTeamSideHoleScore,
  TOURNAMENT_MATCH_HOLES,
} from './tournament-match-scoring';
import {
  computeLiveMatchStatus,
  computeMatchLeadFromResults,
  formatMatchLead,
} from './tournament-match-status';
import { formatTeeTimeLabel } from './tournament-scorecard-routing';

export interface MatchGridCell {
  hole: number;
  value: number | null;
  display: string;
  isWinner?: boolean;
  isHalved?: boolean;
  isPlayed?: boolean;
  /** Direct result: which side won this hole */
  holeWinner?: TournamentMatchHoleWinner | null;
}

export type MatchGridRowKind = 'score' | 'status';

export interface MatchGridRow {
  id: string;
  label: string;
  kind: MatchGridRowKind;
  side?: TournamentTeamSide;
  pairingIndex?: number;
  cells: MatchGridCell[];
}

export interface MatchGridModel {
  matchGroupId: string;
  roundNumber: number;
  format: TournamentFormat;
  formatLabel: string;
  teeTimeLabel: string;
  sideAName: string;
  sideBName: string;
  matchPointsA: number;
  matchPointsB: number;
  throughHole: number;
  inProgress: boolean;
  rows: MatchGridRow[];
}

function scoresForMatchGroup(
  allScores: TournamentScore[],
  group: TournamentMatchGroup
): TournamentScore[] {
  return allScores.filter(
    (score) =>
      score.match_group_id === group.id && score.round_number === group.round_number
  );
}

function buildScoreCells(params: {
  hole: number;
  value: number | null;
  wonHole: boolean;
  halved: boolean;
  holeWinner?: TournamentMatchHoleWinner | null;
}): MatchGridCell {
  const { hole, value, wonHole, halved, holeWinner } = params;
  const isDirectResult = value == null && holeWinner != null;
  return {
    hole,
    value,
    display: isDirectResult ? '' : value == null ? '–' : String(value),
    isPlayed: value != null || holeWinner != null,
    isWinner: wonHole,
    isHalved: halved,
    holeWinner: holeWinner ?? null,
  };
}

function buildRunningStatusRow(
  id: string,
  label: string,
  holeResults: Array<Pick<TournamentMatchHoleResult, 'hole' | 'hole_winner'>>,
  pairingIndex?: number
): MatchGridRow {
  const sorted = [...holeResults].sort((a, b) => a.hole - b.hole);
  const byHole = new Map(sorted.map((row) => [row.hole, row]));
  const cumulative: Array<Pick<TournamentMatchHoleResult, 'hole' | 'hole_winner'>> = [];

  const cells = TOURNAMENT_MATCH_HOLES.map((hole) => {
    const row = byHole.get(hole);
    if (!row) {
      return { hole, value: null, display: '', isPlayed: false };
    }
    cumulative.push(row);
    const lead = computeMatchLeadFromResults(cumulative);
    return {
      hole,
      value: lead,
      display: formatMatchLead(lead),
      isPlayed: true,
    };
  });

  return {
    id,
    label,
    kind: 'status',
    pairingIndex,
    cells,
  };
}

function holeWinnerForPair(
  playerAId: string,
  playerBId: string,
  scores: TournamentScore[],
  hole: number,
  useNetScoring: boolean
): TournamentMatchHoleWinner | null {
  const valueA = getPlayerHoleScoreValue(playerAId, scores, hole, useNetScoring);
  const valueB = getPlayerHoleScoreValue(playerBId, scores, hole, useNetScoring);
  if (valueA === null || valueB === null) return null;
  if (valueA < valueB) return 'side_a';
  if (valueB < valueA) return 'side_b';
  return 'tie';
}

function buildPlayerScoreRow(params: {
  id: string;
  label: string;
  side: TournamentTeamSide;
  playerId: string;
  opponentId: string;
  scores: TournamentScore[];
  useNetScoring: boolean;
  pairingIndex?: number;
}): MatchGridRow {
  const cells = TOURNAMENT_MATCH_HOLES.map((hole) => {
    const value = getPlayerHoleScoreValue(
      params.playerId,
      params.scores,
      hole,
      params.useNetScoring
    );
    const winner = holeWinnerForPair(
      params.playerId,
      params.opponentId,
      params.scores,
      hole,
      params.useNetScoring
    );
    const wonHole =
      winner === 'side_a'
        ? params.side === 'side_a'
        : winner === 'side_b'
          ? params.side === 'side_b'
          : false;

    return buildScoreCells({
      hole,
      value,
      wonHole,
      halved: winner === 'tie' && value != null,
    });
  });

  return {
    id: params.id,
    label: params.label,
    kind: 'score',
    side: params.side,
    pairingIndex: params.pairingIndex,
    cells,
  };
}

function buildTeamScoreRow(params: {
  id: string;
  label: string;
  side: TournamentTeamSide;
  holeValues: (hole: number) => number | null;
  holeWinners: Map<number, TournamentMatchHoleWinner | null>;
}): MatchGridRow {
  const cells = TOURNAMENT_MATCH_HOLES.map((hole) => {
    const value = params.holeValues(hole);
    const winner = params.holeWinners.get(hole) ?? null;
    const wonHole = winner === params.side;
    return buildScoreCells({
      hole,
      value,
      wonHole,
      halved: winner === 'tie' && (value != null || winner != null),
      holeWinner: winner,
    });
  });

  return {
    id: params.id,
    label: params.label,
    kind: 'score',
    side: params.side,
    cells,
  };
}

export function buildMatchGridModel(params: {
  matchGroup: TournamentMatchGroup;
  allScores: TournamentScore[];
  allHoleResults?: TournamentMatchHoleResult[];
  teamNameById: Record<string, string>;
  playerNameById: Record<string, string>;
  useNetScoring: boolean;
}): MatchGridModel {
  const { matchGroup, allScores, allHoleResults, teamNameById, playerNameById, useNetScoring } = params;
  const scores = scoresForMatchGroup(allScores, matchGroup);
  const format = matchGroup.format;
  const sideAName = teamNameById[matchGroup.side_a_team_id] ?? 'TBD';
  const sideBName = teamNameById[matchGroup.side_b_team_id] ?? 'TBD';

  const savedHoleResults =
    allHoleResults?.filter(
      (r) =>
        r.match_group_id === matchGroup.id && r.round_number === matchGroup.round_number
    ) ?? [];

  const overallHoleResults =
    savedHoleResults.length > 0
      ? savedHoleResults.filter((r) => (r.pairing_index ?? 0) === 0 || !isSinglesFormat(format))
      : computeMatchHoleResults(
          matchGroup,
          matchGroup.round_number,
          format,
          scores,
          { useNetScoring }
        );

  const holeWinners = new Map<number, TournamentMatchHoleWinner | null>(
    TOURNAMENT_MATCH_HOLES.map((hole) => {
      const row = overallHoleResults.find((result) => result.hole === hole);
      return [hole, row?.hole_winner ?? null];
    })
  );

  const rows: MatchGridRow[] = [];

  if (isSinglesFormat(format)) {
    const pairCount = Math.min(
      matchGroup.side_a_player_ids.length,
      matchGroup.side_b_player_ids.length
    );

    for (let i = 0; i < pairCount; i++) {
      const playerAId = matchGroup.side_a_player_ids[i];
      const playerBId = matchGroup.side_b_player_ids[i];
      if (!playerAId || !playerBId) continue;

      const pairResults = savedHoleResults.filter(
        (r) => (r.pairing_index ?? 0) === i
      );
      const pairHoleResults =
        pairResults.length > 0
          ? pairResults
          : computeSinglesPairHoleResults(
              matchGroup,
              matchGroup.round_number,
              playerAId,
              playerBId,
              scores,
              useNetScoring
            );

      rows.push(
        buildPlayerScoreRow({
          id: `${matchGroup.id}-a-${i}`,
          label: playerNameById[playerAId] ?? `Player ${i + 1}`,
          side: 'side_a',
          playerId: playerAId,
          opponentId: playerBId,
          scores,
          useNetScoring,
          pairingIndex: i,
        }),
        buildPlayerScoreRow({
          id: `${matchGroup.id}-b-${i}`,
          label: playerNameById[playerBId] ?? `Opponent ${i + 1}`,
          side: 'side_b',
          playerId: playerBId,
          opponentId: playerAId,
          scores,
          useNetScoring,
          pairingIndex: i,
        }),
        buildRunningStatusRow(
          `${matchGroup.id}-pair-status-${i}`,
          'Match',
          pairHoleResults,
          i
        )
      );
    }

    rows.push(
      buildRunningStatusRow(`${matchGroup.id}-overall-status`, 'Overall', overallHoleResults)
    );
  } else if (format === 'best_ball') {
    rows.push(
      buildTeamScoreRow({
        id: `${matchGroup.id}-side-a`,
        label: `${sideAName} (best)`,
        side: 'side_a',
        holeWinners,
        holeValues: (hole) =>
          getSideBestBallHoleScore(
            matchGroup.side_a_player_ids,
            scores,
            hole,
            useNetScoring
          ),
      }),
      buildTeamScoreRow({
        id: `${matchGroup.id}-side-b`,
        label: `${sideBName} (best)`,
        side: 'side_b',
        holeWinners,
        holeValues: (hole) =>
          getSideBestBallHoleScore(
            matchGroup.side_b_player_ids,
            scores,
            hole,
            useNetScoring
          ),
      }),
      buildRunningStatusRow(`${matchGroup.id}-status`, 'Match', overallHoleResults)
    );
  } else {
    rows.push(
      buildTeamScoreRow({
        id: `${matchGroup.id}-side-a`,
        label: sideAName,
        side: 'side_a',
        holeWinners,
        holeValues: (hole) =>
          getTeamSideHoleScore(matchGroup.side_a_team_id, scores, hole, useNetScoring),
      }),
      buildTeamScoreRow({
        id: `${matchGroup.id}-side-b`,
        label: sideBName,
        side: 'side_b',
        holeWinners,
        holeValues: (hole) =>
          getTeamSideHoleScore(matchGroup.side_b_team_id, scores, hole, useNetScoring),
      }),
      buildRunningStatusRow(`${matchGroup.id}-status`, 'Match', overallHoleResults)
    );
  }

  const liveStatus = computeLiveMatchStatus({ holeResults: overallHoleResults });
  const inProgress =
    liveStatus.throughHole > 0 &&
    matchGroup.match_winner == null &&
    !liveStatus.clinched;

  return {
    matchGroupId: matchGroup.id,
    roundNumber: matchGroup.round_number,
    format,
    formatLabel: formatLabel(format),
    teeTimeLabel: formatTeeTimeLabel(matchGroup.tee_time),
    sideAName,
    sideBName,
    matchPointsA: matchGroup.match_points_a ?? 0,
    matchPointsB: matchGroup.match_points_b ?? 0,
    throughHole: liveStatus.throughHole,
    inProgress,
    rows,
  };
}

export function buildMatchGridModels(params: {
  matchGroups: TournamentMatchGroup[];
  allScores: TournamentScore[];
  allHoleResults?: TournamentMatchHoleResult[];
  teamNameById: Record<string, string>;
  playerNameById: Record<string, string>;
  useNetScoring: boolean;
}): MatchGridModel[] {
  return [...params.matchGroups]
    .sort(
      (a, b) =>
        a.round_number - b.round_number ||
        new Date(a.tee_time).getTime() - new Date(b.tee_time).getTime() ||
        a.group_number - b.group_number
    )
    .map((matchGroup) =>
      buildMatchGridModel({
        matchGroup,
        allScores: params.allScores,
        allHoleResults: params.allHoleResults,
        teamNameById: params.teamNameById,
        playerNameById: params.playerNameById,
        useNetScoring: params.useNetScoring,
      })
    );
}

export function groupMatchGridsByRound(
  models: MatchGridModel[]
): Array<{ roundNumber: number; matches: MatchGridModel[] }> {
  const byRound = new Map<number, MatchGridModel[]>();
  for (const model of models) {
    const list = byRound.get(model.roundNumber) ?? [];
    list.push(model);
    byRound.set(model.roundNumber, list);
  }
  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([roundNumber, matches]) => ({
      roundNumber,
      matches: [...matches].sort((a, b) => {
        if (a.inProgress !== b.inProgress) return a.inProgress ? -1 : 1;
        return 0;
      }),
    }));
}
