/**
 * Tee sheet rows for TV / clubhouse display — time-aware match status.
 */

import {
  buildMatchStatusFromHoleResults,
  formatMatchResultSummary,
  isMatchActuallyComplete,
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
import type { MatchStatus } from './tournament-match-status';

export type TeeSheetDisplayStatus = 'upcoming' | 'on_course' | 'live' | 'complete';

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

export interface TvLiveEmptySummary {
  onCourseCount: number;
  onCourseRows: Array<{
    teeTimeLabel: string;
    groupNumber: number;
    sideAName: string;
    sideBName: string;
  }>;
  nextUp: { teeTimeLabel: string; groupNumber: number } | null;
  allFinal: boolean;
}

const ON_TEE_GRACE_MS = 2 * 60 * 1000;

export function resolveTeeSheetDisplayStatus(
  group: TournamentMatchGroup,
  playStatus: MatchPlayStatus,
  matchStatus: MatchStatus,
  holeResultCount: number,
  now: Date = new Date()
): TeeSheetDisplayStatus {
  if (isMatchActuallyComplete(group, matchStatus, holeResultCount)) return 'complete';
  if (playStatus === 'in_progress' || holeResultCount > 0) return 'live';

  const teeMs = new Date(group.tee_time).getTime();
  const nowMs = now.getTime();

  if (nowMs + ON_TEE_GRACE_MS < teeMs) return 'upcoming';
  return 'on_course';
}

export function teeSheetStatusLabel(status: TeeSheetDisplayStatus): string {
  switch (status) {
    case 'live':
      return 'Live';
    case 'on_course':
      return 'On course';
    case 'complete':
      return 'Final';
    default:
      return 'Up next';
  }
}

export function summarizeTvLiveEmptyState(rows: TournamentTeeSheetRow[]): TvLiveEmptySummary {
  const active = rows.filter(
    (row) => row.displayStatus === 'on_course' || row.displayStatus === 'live'
  );
  const nextUp = rows.find((row) => row.displayStatus === 'upcoming');

  return {
    onCourseCount: active.length,
    onCourseRows: active.slice(0, 3).map((row) => ({
      teeTimeLabel: row.teeTimeLabel,
      groupNumber: row.groupNumber,
      sideAName: row.sideAName,
      sideBName: row.sideBName,
    })),
    nextUp: nextUp
      ? { teeTimeLabel: nextUp.teeTimeLabel, groupNumber: nextUp.groupNumber }
      : null,
    allFinal: rows.length > 0 && rows.every((row) => row.displayStatus === 'complete'),
  };
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
      const groupHoles = holeResults.filter((row) => row.match_group_id === group.id);
      const { matchStatus, playStatus } = buildMatchStatusFromHoleResults(
        group,
        holeResults,
        sideAName,
        sideBName
      );
      const displayStatus = resolveTeeSheetDisplayStatus(
        group,
        playStatus,
        matchStatus,
        groupHoles.length,
        now
      );

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
