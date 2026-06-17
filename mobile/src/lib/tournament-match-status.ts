/**
 * Live match-play status labels (AS, 1 UP, 3 & 2, etc.) from hole results.
 */

import type { TournamentMatchHoleResult, TournamentTeamSide } from '@/types';

export interface MatchStatus {
  /** Display label e.g. "AS", "1 UP", "2 DN", "3 & 2" */
  label: string;
  /** Leading side, or null when all square / no holes played */
  leadingSide: TournamentTeamSide | null;
  /** Signed lead: positive = side A up, negative = side B up */
  lead: number;
  /** Holes decided (non-tie with both scores present) */
  holesPlayed: number;
  /** Match clinched (lead > holes remaining) */
  clinched: boolean;
  /** Holes remaining after last played hole */
  holesRemaining: number;
  /** Last hole included in calculation */
  throughHole: number;
}

export function formatMatchLead(lead: number, perspectiveSide?: TournamentTeamSide): string {
  if (lead === 0) return 'AS';

  const abs = Math.abs(lead);
  const suffix = abs === 1 ? ' UP' : ' UP';

  if (perspectiveSide === 'side_b') {
    if (lead < 0) return `${abs}${suffix}`;
    return `${abs} DN`;
  }

  if (lead > 0) return `${abs}${suffix}`;
  return `${abs} DN`;
}

export function formatMatchStatusLabel(
  lead: number,
  holesRemaining: number,
  perspectiveSide: TournamentTeamSide = 'side_a',
  sideAName?: string,
  sideBName?: string
): string {
  if (lead === 0) return 'AS';

  const clinched = Math.abs(lead) > holesRemaining;
  if (clinched) {
    const abs = Math.abs(lead);
    const margin = holesRemaining;
    const winner =
      lead > 0
        ? sideAName ?? 'Side A'
        : sideBName ?? 'Side B';
    return `${abs} & ${margin} · ${winner}`;
  }

  return formatMatchLead(lead, perspectiveSide);
}

export function computeMatchLeadFromResults(
  results: Array<Pick<TournamentMatchHoleResult, 'hole' | 'hole_winner'>>,
  throughHole: number = 18
): number {
  let lead = 0;

  for (const row of results) {
    if (row.hole > throughHole) continue;
    if (row.hole_winner === 'side_a') lead += 1;
    else if (row.hole_winner === 'side_b') lead -= 1;
  }

  return lead;
}

export function computeLiveMatchStatus(params: {
  holeResults: Array<Pick<TournamentMatchHoleResult, 'hole' | 'hole_winner'>>;
  throughHole?: number;
  perspectiveSide?: TournamentTeamSide;
  sideAName?: string;
  sideBName?: string;
  totalHoles?: number;
}): MatchStatus {
  const totalHoles = params.totalHoles ?? 18;
  const perspectiveSide = params.perspectiveSide ?? 'side_a';

  const relevant =
    params.throughHole != null
      ? params.holeResults.filter((row) => row.hole <= params.throughHole!)
      : params.holeResults;

  const sorted = [...relevant].sort((a, b) => a.hole - b.hole);
  const lead = computeMatchLeadFromResults(sorted, totalHoles);
  const lastPlayedHole =
    sorted.length > 0 ? Math.max(...sorted.map((row) => row.hole)) : 0;
  const holesRemaining = Math.max(0, totalHoles - lastPlayedHole);
  const clinched = lead !== 0 && Math.abs(lead) > holesRemaining;

  const label = formatMatchStatusLabel(
    lead,
    holesRemaining,
    perspectiveSide,
    params.sideAName,
    params.sideBName
  );

  return {
    label,
    leadingSide: lead > 0 ? 'side_a' : lead < 0 ? 'side_b' : null,
    lead,
    holesPlayed: relevant.filter((r) => r.hole_winner !== 'tie').length,
    clinched,
    holesRemaining,
    throughHole: lastPlayedHole,
  };
}

export type HoleOutcome = 'win' | 'loss' | 'halved' | 'pending';

export interface RecentHoleOutcomeRow {
  hole: number;
  outcome: HoleOutcome;
}

export function holeOutcomeForSide(
  winner: TournamentMatchHoleResult['hole_winner'] | undefined,
  side: TournamentTeamSide
): HoleOutcome {
  if (!winner) return 'pending';
  if (winner === 'tie') return 'halved';
  if (winner === side) return 'win';
  return 'loss';
}

export function recentHoleOutcomes(
  results: Array<Pick<TournamentMatchHoleResult, 'hole' | 'hole_winner'>>,
  side: TournamentTeamSide,
  count: number = 6
): HoleOutcome[] {
  return recentHoleOutcomeRows(results, side, count).map((row) => row.outcome);
}

/** Up to `count` most recent decided holes, oldest → newest (left → right). */
export function recentHoleOutcomeRows(
  results: Array<Pick<TournamentMatchHoleResult, 'hole' | 'hole_winner'>>,
  side: TournamentTeamSide,
  count: number = 6
): RecentHoleOutcomeRow[] {
  const sorted = [...results].sort((a, b) => b.hole - a.hole);
  return sorted
    .slice(0, count)
    .reverse()
    .map((row) => ({
      hole: row.hole,
      outcome: holeOutcomeForSide(row.hole_winner, side),
    }));
}
