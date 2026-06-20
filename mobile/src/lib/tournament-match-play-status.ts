import {
  holeResultsToOutcomes,
  outcomesMapToHoleResultRows,
} from '@/lib/match-hole-outcomes';
import { computeLiveMatchStatus, type MatchStatus } from '@/lib/tournament-match-status';
import { computeMatchHoleResults } from '@/lib/tournament-match-scoring';
import type {
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentScore,
} from '@/types';

export type MatchPlayStatus = 'not_started' | 'in_progress' | 'complete';

export type MatchGroupDisplayTone = 'scheduled' | 'progress' | 'complete';

export type MatchGroupDisplayStatus = {
  label: string;
  tone: MatchGroupDisplayTone;
};

export const ON_TEE_GRACE_MS = 2 * 60 * 1000;

export function hasRecordedMatchResult(
  group: Pick<TournamentMatchGroup, 'match_winner' | 'match_points_a' | 'match_points_b'>
): boolean {
  return (
    group.match_winner != null ||
    group.match_points_a > 0 ||
    group.match_points_b > 0
  );
}

export function isAdminDeclaredMatchResult(
  group: Pick<TournamentMatchGroup, 'match_result_declared' | 'match_winner'>
): boolean {
  return Boolean(group.match_result_declared && group.match_winner != null);
}

export type OfficialMatchCupPoints = {
  match_winner: TournamentMatchGroup['match_winner'];
  match_points_a: number;
  match_points_b: number;
};

/** Cup points that count toward team standings — complete matches or admin-declared only. */
export function getOfficialMatchCupPoints(
  group: TournamentMatchGroup,
  playStatus: MatchPlayStatus
): OfficialMatchCupPoints | null {
  if (isAdminDeclaredMatchResult(group)) {
    return {
      match_winner: group.match_winner ?? null,
      match_points_a: group.match_points_a,
      match_points_b: group.match_points_b,
    };
  }

  if (playStatus !== 'complete' || group.match_winner == null) {
    return null;
  }

  const pointsA = Number(group.match_points_a ?? 0);
  const pointsB = Number(group.match_points_b ?? 0);
  if (pointsA === 0 && pointsB === 0) {
    return null;
  }

  return {
    match_winner: group.match_winner,
    match_points_a: pointsA,
    match_points_b: pointsB,
  };
}

export function isMatchActuallyComplete(
  group: Pick<
    TournamentMatchGroup,
    'match_winner' | 'match_points_a' | 'match_points_b' | 'match_result_declared'
  >,
  matchStatus: MatchStatus,
  holeResultCount: number
): boolean {
  if (isAdminDeclaredMatchResult(group)) return true;

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
  group?: Pick<
    TournamentMatchGroup,
    'match_winner' | 'match_points_a' | 'match_points_b' | 'match_result_declared'
  > | null,
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

export function isMatchGroupOnCourse(
  group: Pick<TournamentMatchGroup, 'tee_time'>,
  now: Date = new Date()
): boolean {
  const teeMs = new Date(group.tee_time).getTime();
  return now.getTime() + ON_TEE_GRACE_MS >= teeMs;
}

export function resolveEffectiveGroupHoleResults(
  group: TournamentMatchGroup,
  holeResults: TournamentMatchHoleResult[],
  scores?: TournamentScore[],
  useNetScoring = false
): TournamentMatchHoleResult[] {
  const persisted = holeResults.filter((row) => row.match_group_id === group.id);
  if (persisted.length > 0) return persisted;

  if (!scores || scores.length === 0) return [];

  const groupScores = scores.filter(
    (score) =>
      score.match_group_id === group.id && score.round_number === group.round_number
  );
  if (groupScores.length === 0) return [];

  return computeMatchHoleResults(
    group,
    group.round_number,
    group.format,
    groupScores,
    { useNetScoring }
  ) as TournamentMatchHoleResult[];
}

export function buildMatchStatusFromHoleResults(
  group: TournamentMatchGroup,
  holeResults: TournamentMatchHoleResult[],
  sideAName: string,
  sideBName: string,
  options?: {
    scores?: TournamentScore[];
    useNetScoring?: boolean;
  }
): { matchStatus: MatchStatus; playStatus: MatchPlayStatus } {
  const groupHoles = resolveEffectiveGroupHoleResults(
    group,
    holeResults,
    options?.scores,
    options?.useNetScoring ?? false
  );
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

export function resolveMatchGroupDisplayStatus(
  group: TournamentMatchGroup,
  playStatus: MatchPlayStatus,
  matchStatus: MatchStatus,
  holeResultCount: number,
  now: Date = new Date()
): MatchGroupDisplayStatus {
  if (isMatchActuallyComplete(group, matchStatus, holeResultCount)) {
    return { label: 'Match complete', tone: 'complete' };
  }

  if (playStatus === 'in_progress' || holeResultCount > 0) {
    return { label: 'In progress', tone: 'progress' };
  }

  if (isMatchGroupOnCourse(group, now)) {
    return { label: 'On course', tone: 'progress' };
  }

  return { label: 'Scheduled', tone: 'scheduled' };
}

export function formatMatchPlayStatusLabel(
  status: MatchPlayStatus,
  group?: Pick<TournamentMatchGroup, 'tee_time'>,
  now: Date = new Date()
): string {
  if (status === 'complete') return 'Match complete';
  if (status === 'in_progress') return 'In progress';
  if (group && isMatchGroupOnCourse(group, now)) return 'On course';
  return 'Scheduled';
}

export function formatMatchResultSummary(
  group: TournamentMatchGroup,
  matchStatus: MatchStatus,
  sideAName: string,
  sideBName: string
): string | null {
  if (isAdminDeclaredMatchResult(group)) {
    if (group.match_winner === 'tie') return 'Halved';
    if (group.match_winner === 'side_a') return `${sideAName} won`;
    if (group.match_winner === 'side_b') return `${sideBName} won`;
  }

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
