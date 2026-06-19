/**
 * Tee sheet rows for TV / clubhouse display — time-aware match status.
 */

import {
  buildMatchStatusFromHoleResults,
  formatMatchResultSummary,
  type MatchPlayStatus,
} from './tournament-match-play-status';
import { getMatchGroupFormat, getTeamSideDisplayName, isSinglesFormat } from './tournament-labels';
import { formatTeeAssignmentTime } from './tournament-tee-service';
import type {
  Tournament,
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentTeam,
} from '@/types';

export type TeeSheetDisplayStatus = 'upcoming' | 'on_tee' | 'live' | 'complete';

export interface TournamentTeeSheetRow {
  groupId: string;
  groupNumber: number;
  teeTimeLabel: string;
  teeTimeMs: number;
  sideAName: string;
  sideBName: string;
  playersLabel: string;
  displayStatus: TeeSheetDisplayStatus;
  statusLabel: string;
  resultSummary: string | null;
}

const ON_TEE_LEAD_MS = 15 * 60 * 1000;

export function resolveTeeSheetDisplayStatus(
  group: TournamentMatchGroup,
  playStatus: MatchPlayStatus,
  now: Date = new Date()
): TeeSheetDisplayStatus {
  if (playStatus === 'complete') return 'complete';
  if (playStatus === 'in_progress') return 'live';

  const teeMs = new Date(group.tee_time).getTime();
  if (now.getTime() >= teeMs - ON_TEE_LEAD_MS) return 'on_tee';
  return 'upcoming';
}

export function teeSheetStatusLabel(status: TeeSheetDisplayStatus): string {
  switch (status) {
    case 'live':
      return 'Live';
    case 'on_tee':
      return 'On tee';
    case 'complete':
      return 'Final';
    default:
      return 'Up next';
  }
}

function formatPlayersLabel(
  group: TournamentMatchGroup,
  tournament: Tournament,
  playerNameById: Record<string, string>
): string {
  const format = getMatchGroupFormat(group, tournament);

  if (isSinglesFormat(format)) {
    const pairCount = Math.max(group.side_a_player_ids.length, group.side_b_player_ids.length, 1);
    const pairs = Array.from({ length: pairCount }, (_, index) => {
      const a = playerNameById[group.side_a_player_ids[index] ?? ''] ?? 'TBD';
      const b = playerNameById[group.side_b_player_ids[index] ?? ''] ?? 'TBD';
      return `${a} vs ${b}`;
    });
    return pairs.join(' · ');
  }

  const sideA = group.side_a_player_ids
    .map((id) => playerNameById[id] ?? 'TBD')
    .join(' / ');
  const sideB = group.side_b_player_ids
    .map((id) => playerNameById[id] ?? 'TBD')
    .join(' / ');
  return `${sideA} · ${sideB}`;
}

export function buildTournamentTeeSheetRows(params: {
  tournament: Tournament;
  teams: TournamentTeam[];
  matchGroups: TournamentMatchGroup[];
  holeResults: TournamentMatchHoleResult[];
  playerNameById: Record<string, string>;
  roundNumber: number;
  now?: Date;
}): TournamentTeeSheetRow[] {
  const { tournament, teams, matchGroups, holeResults, playerNameById, roundNumber } = params;
  const now = params.now ?? new Date();
  const sideAName = getTeamSideDisplayName('side_a', teams);
  const sideBName = getTeamSideDisplayName('side_b', teams);

  return [...matchGroups]
    .filter((group) => group.round_number === roundNumber)
    .sort(
      (a, b) =>
        new Date(a.tee_time).getTime() - new Date(b.tee_time).getTime() ||
        a.group_number - b.group_number
    )
    .map((group) => {
      const { matchStatus, playStatus } = buildMatchStatusFromHoleResults(
        group,
        holeResults,
        sideAName,
        sideBName
      );
      const displayStatus = resolveTeeSheetDisplayStatus(group, playStatus, now);

      return {
        groupId: group.id,
        groupNumber: group.group_number,
        teeTimeLabel: formatTeeAssignmentTime(group.tee_time),
        teeTimeMs: new Date(group.tee_time).getTime(),
        sideAName,
        sideBName,
        playersLabel: formatPlayersLabel(group, tournament, playerNameById),
        displayStatus,
        statusLabel: teeSheetStatusLabel(displayStatus),
        resultSummary: formatMatchResultSummary(group, matchStatus, sideAName, sideBName),
      };
    });
}
