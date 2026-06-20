import {
  holeResultsToOutcomes,
  outcomesMapToHoleResultRows,
} from '@/lib/match-hole-outcomes';
import {
  resolveMatchWinnerSide,
  type MatchPlayStatus,
} from '@/lib/tournament-match-play-status';
import { computeLiveMatchStatus, type MatchStatus } from '@/lib/tournament-match-status';
import type { TournamentMatchHoleResult } from '@/types';

export type PairingMatchStatus = {
  matchStatus: MatchStatus;
  playStatus: MatchPlayStatus;
  resultSummary: string | null;
  winnerSide: ReturnType<typeof resolveMatchWinnerSide>;
};

export function resolvePairingPlayStatus(matchStatus: MatchStatus): MatchPlayStatus {
  if (matchStatus.throughHole === 0) return 'not_started';
  if (matchStatus.clinched) return 'complete';
  if (matchStatus.throughHole >= 18) return 'complete';
  return 'in_progress';
}

export function formatPairingResultSummary(
  matchStatus: MatchStatus,
  sideAName: string,
  sideBName: string
): string | null {
  if (matchStatus.throughHole === 0) return null;

  if (matchStatus.clinched) {
    return matchStatus.label;
  }

  if (matchStatus.throughHole >= 18) {
    if (matchStatus.lead === 0) return 'Halved';
    if (matchStatus.lead > 0) return `${sideAName} won`;
    if (matchStatus.lead < 0) return `${sideBName} won`;
  }

  return matchStatus.label;
}

export function buildPairingMatchStatus(
  groupHoleResults: Array<
    Pick<TournamentMatchHoleResult, 'hole' | 'hole_winner' | 'pairing_index'>
  >,
  pairingIndex: number,
  sideAName: string,
  sideBName: string
): PairingMatchStatus {
  const pairingResults = groupHoleResults.filter(
    (row) => (row.pairing_index ?? 0) === pairingIndex
  );
  const outcomes = holeResultsToOutcomes(pairingResults, pairingIndex);
  const rows = outcomesMapToHoleResultRows(outcomes);
  const matchStatus = computeLiveMatchStatus({
    holeResults: rows,
    sideAName,
    sideBName,
  });
  const playStatus = resolvePairingPlayStatus(matchStatus);
  const resultSummary = formatPairingResultSummary(matchStatus, sideAName, sideBName);
  const winnerSide = resolveMatchWinnerSide(null, matchStatus);

  return { matchStatus, playStatus, resultSummary, winnerSide };
}
