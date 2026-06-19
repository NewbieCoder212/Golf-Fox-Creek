import {
  holeResultsToOutcomes,
  outcomesMapToHoleResultRows,
} from '@/lib/match-hole-outcomes';
import { computeLiveMatchStatus, type MatchStatus } from '@/lib/tournament-match-status';
import type { TournamentMatchGroup, TournamentMatchHoleResult } from '@/types';

export type MatchPlayStatus = 'not_started' | 'in_progress' | 'complete';

export function hasRecordedMatchResult(
  group: Pick<TournamentMatchGroup, 'match_winner' | 'match_points_a' | 'match_points_b'>
): boolean {
  return (
    group.match_winner != null ||
    group.match_points_a > 0 ||
    group.match_points_b > 0
  );
}

export function isMatchActuallyComplete(
  group: Pick<TournamentMatchGroup, 'match_winner' | 'match_points_a' | 'match_points_b'>,
  matchStatus: MatchStatus,
  holeResultCount: number
): boolean {
  if (matchStatus.clinched) return true;

  if (matchStatus.throughHole >= 18) {
    if (matchStatus.lead !== 0) return true;
    if (group.match_winner === 'tie') return true;
  }

  // Persisted winner with partial scoring — only final once clinched or through 18
  if (group.match_winner != null && holeResultCount > 0) {
    return matchStatus.clinched || matchStatus.throughHole >= 18;
  }

  return false;
}

export function isMatchPlayComplete(
  status: MatchStatus,
  group?: Pick<TournamentMatchGroup, 'match_winner' | 'match_points_a' | 'match_points_b'> | null,
  holeResultCount = 0
): boolean {
  if (!group) return false;
  return isMatchActuallyComplete(group, status, holeResultCount);
}

export function resolveMatchGroupPlayStatus(
  group: TournamentMatchGroup,
  matchStatus: MatchStatus,
  holeResultCount: number
): MatchPlayStatus {
  if (isMatchPlayComplete(matchStatus, group, holeResultCount)) {
    return 'complete';
  }

  if (
    holeResultCount > 0 ||
    group.match_points_a > 0 ||
    group.match_points_b > 0
  ) {
    return 'in_progress';
  }

  return 'not_started';
}

export function buildMatchStatusFromHoleResults(
  group: TournamentMatchGroup,
  holeResults: TournamentMatchHoleResult[],
  sideAName: string,
  sideBName: string
): { matchStatus: MatchStatus; playStatus: MatchPlayStatus } {
  const groupHoles = holeResults.filter((row) => row.match_group_id === group.id);
  const outcomes = holeResultsToOutcomes(groupHoles);
  const rows = outcomesMapToHoleResultRows(outcomes);
  const matchStatus = computeLiveMatchStatus({
    holeResults: rows,
    perspectiveSide: 'side_a',
    sideAName,
    sideBName,
  });
  const playStatus = resolveMatchGroupPlayStatus(group, matchStatus, groupHoles.length);

  return { matchStatus, playStatus };
}

export function formatMatchPlayStatusLabel(status: MatchPlayStatus): string {
  if (status === 'complete') return 'Match complete';
  if (status === 'in_progress') return 'In progress';
  return 'Scheduled';
}

export function formatMatchResultSummary(
  group: TournamentMatchGroup,
  matchStatus: MatchStatus,
  sideAName: string,
  sideBName: string
): string | null {
  if (matchStatus.throughHole > 0) {
    return matchStatus.label;
  }

  if (group.match_winner === 'tie') return 'Halved';
  if (group.match_winner === 'side_a') return `${sideAName} won`;
  if (group.match_winner === 'side_b') return `${sideBName} won`;
  return null;
}

/** Winning team when a match is final, from persisted winner or clinched/live lead. */
export function resolveMatchWinnerSide(
  group: Pick<TournamentMatchGroup, 'match_winner'> | null | undefined,
  matchStatus: Pick<MatchStatus, 'lead' | 'clinched' | 'throughHole'>
): 'side_a' | 'side_b' | 'tie' | null {
  if (group?.match_winner === 'side_a' || group?.match_winner === 'side_b') {
    return group.match_winner;
  }
  if (group?.match_winner === 'tie') return 'tie';

  if (matchStatus.clinched || (matchStatus.throughHole >= 18 && matchStatus.lead !== 0)) {
    if (matchStatus.lead > 0) return 'side_a';
    if (matchStatus.lead < 0) return 'side_b';
  }

  if (matchStatus.throughHole >= 18 && matchStatus.lead === 0) {
    return 'tie';
  }

  return null;
}
