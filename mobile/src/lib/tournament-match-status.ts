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
  /** Dormie: lead equals holes remaining (e.g. 2 UP with 2 to play) */
  dormie: boolean;
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

/** Leader-relative label for TV / public boards — always names the team that is up. */
export function formatMatchLeadWithTeams(
  lead: number,
  sideAName?: string,
  sideBName?: string,
  options?: { compact?: boolean }
): string {
  if (lead === 0) return options?.compact ? 'AS' : 'ALL SQUARE';

  const abs = Math.abs(lead);
  const leaderName = (lead > 0 ? sideAName : sideBName)?.trim();
  if (!leaderName) return formatMatchLead(lead);

  if (options?.compact) {
    const short = leaderName.split(/\s+/)[0]?.slice(0, 4) ?? leaderName.slice(0, 4);
    return `${short} ${abs}UP`;
  }

  return `${leaderName} ${abs} UP`;
}

export function formatMatchStatusLabel(
  lead: number,
  holesRemaining: number,
  _perspectiveSide: TournamentTeamSide = 'side_a',
  sideAName?: string,
  sideBName?: string
): string {
  if (lead === 0) return 'ALL SQUARE';

  const clinched = Math.abs(lead) > holesRemaining;
  if (clinched) {
    const abs = Math.abs(lead);
    const margin = holesRemaining;
    const winner = lead > 0 ? sideAName ?? 'TBD' : sideBName ?? 'TBD';
    return `${winner} ${abs} & ${margin}`;
  }

  const dormie = Math.abs(lead) === holesRemaining && holesRemaining > 0;
  const leaderName = lead > 0 ? sideAName ?? 'TBD' : sideBName ?? 'TBD';
  const abs = Math.abs(lead);

  if (dormie) {
    return `${leaderName} ${abs} UP · DORMIE`;
  }

  return formatMatchLeadWithTeams(lead, sideAName, sideBName);
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
  const dormie =
    !clinched && lead !== 0 && Math.abs(lead) === holesRemaining && holesRemaining > 0;

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
    dormie,
    holesRemaining,
    throughHole: lastPlayedHole,
  };
}

/** First hole after which match is clinched (remaining holes locked). */
export function getClinchThroughHole(status: MatchStatus, totalHoles: number = 18): number | null {
  if (!status.clinched) return null;
  return status.throughHole;
}

export function isHoleLocked(
  hole: number,
  status: MatchStatus,
  totalHoles: number = 18
): boolean {
  if (!status.clinched) return false;
  const clinchHole = getClinchThroughHole(status, totalHoles);
  if (clinchHole == null) return false;
  return hole > clinchHole;
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
