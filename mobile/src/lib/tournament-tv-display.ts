/**
 * TV display helpers — current round from schedule + tee times (club timezone).
 */

import type {
  Tournament,
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentTeam,
} from '@/types';
import { clubDateInputValue, formatInClubTimezone } from './club-timezone';
import { getTeamBySide } from './tournament-match-service';
import { buildMatchPointsLeaderboardFromHoleResults } from './tournament-service';
import { getActiveRoundNumber } from './tournament-scorecard-routing';
import {
  buildTournamentTeeSheetRows,
  summarizeTvLiveEmptyState,
} from './tournament-tee-sheet';

function isSameClubDay(a: string | Date, b: string | Date): boolean {
  const aIso = typeof a === 'string' ? a : a.toISOString();
  const bIso = typeof b === 'string' ? b : b.toISOString();
  return clubDateInputValue(aIso) === clubDateInputValue(bIso);
}

function firstTeeByRound(groups: TournamentMatchGroup[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const group of groups) {
    const teeMs = new Date(group.tee_time).getTime();
    const existing = map.get(group.round_number);
    if (existing == null || teeMs < existing) {
      map.set(group.round_number, teeMs);
    }
  }
  return map;
}

/**
 * Round to show on the clubhouse TV: calendar day from schedule, refined by today's tee times.
 */
export function getTvDisplayRoundNumber(
  tournament: Pick<Tournament, 'start_date' | 'round_schedule' | 'rounds_count'>,
  matchGroups: TournamentMatchGroup[],
  now: Date = new Date()
): number {
  const calendarRound = getActiveRoundNumber(tournament);
  const todayGroups = matchGroups.filter((group) => isSameClubDay(group.tee_time, now));

  if (todayGroups.length === 0) {
    return calendarRound;
  }

  const roundsToday = [...new Set(todayGroups.map((group) => group.round_number))].sort(
    (a, b) => a - b
  );

  if (roundsToday.length === 1) {
    return roundsToday[0];
  }

  const firstTee = firstTeeByRound(todayGroups);
  const sorted = [...firstTee.entries()].sort((a, b) => a[1] - b[1]);
  const nowMs = now.getTime();

  for (let index = 0; index < sorted.length; index += 1) {
    const [round, teeMs] = sorted[index];
    const nextTee = sorted[index + 1]?.[1];
    if (nowMs < teeMs) {
      return round;
    }
    if (nextTee == null || nowMs < nextTee) {
      return round;
    }
  }

  return sorted[sorted.length - 1][0];
}

export function filterMatchGroupsForRound(
  matchGroups: TournamentMatchGroup[],
  roundNumber: number
): TournamentMatchGroup[] {
  return matchGroups.filter((group) => group.round_number === roundNumber);
}

export function getTournamentEventTitle(
  tournament: Pick<Tournament, 'start_date' | 'name'>
): string {
  const year = formatInClubTimezone(tournament.start_date, { year: 'numeric' });
  return `${year} ${tournament.name}`;
}

export function isTournamentTvComplete(params: {
  tournament: Tournament;
  teams: TournamentTeam[];
  matchGroups: TournamentMatchGroup[];
  holeResults: TournamentMatchHoleResult[];
  playerNameById: Record<string, string>;
  now?: Date;
}): boolean {
  const { tournament, teams, matchGroups, holeResults, playerNameById, now } = params;
  if (matchGroups.length === 0) return false;

  for (let round = 1; round <= tournament.rounds_count; round += 1) {
    const roundGroups = matchGroups.filter((group) => group.round_number === round);
    if (roundGroups.length === 0) return false;

    const rows = buildTournamentTeeSheetRows({
      tournament,
      teams,
      matchGroups,
      holeResults,
      playerNameById,
      roundNumber: round,
      now,
    });
    if (!summarizeTvLiveEmptyState(rows).allFinal) return false;
  }

  return true;
}

export interface TournamentTvChampionResult {
  team: TournamentTeam;
  eventTitle: string;
  championPoints: number;
  opponentPoints: number;
  retainedOnTie: boolean;
}

export function getTournamentTvChampion(params: {
  tournament: Tournament;
  teams: TournamentTeam[];
  matchGroups: TournamentMatchGroup[];
  holeResults: TournamentMatchHoleResult[];
}): TournamentTvChampionResult | null {
  const standings = buildMatchPointsLeaderboardFromHoleResults(
    params.teams,
    params.matchGroups,
    params.holeResults
  );

  if (standings.length === 0) return null;

  const eventTitle = getTournamentEventTitle(params.tournament);
  const leader = standings[0];
  const runnerUp = standings[1];

  if (!runnerUp || leader.matchPoints !== runnerUp.matchPoints) {
    const team = params.teams.find((row) => row.id === leader.teamId);
    if (!team) return null;

    return {
      team,
      eventTitle,
      championPoints: leader.matchPoints,
      opponentPoints: runnerUp?.matchPoints ?? 0,
      retainedOnTie: false,
    };
  }

  const defendingSide = params.tournament.defending_champion_side;
  if (!defendingSide) return null;

  const team = getTeamBySide(params.teams, defendingSide);
  if (!team) return null;

  const championStanding = standings.find((row) => row.teamId === team.id);
  const opponentStanding = standings.find((row) => row.teamId !== team.id);

  return {
    team,
    eventTitle,
    championPoints: championStanding?.matchPoints ?? leader.matchPoints,
    opponentPoints: opponentStanding?.matchPoints ?? runnerUp.matchPoints,
    retainedOnTie: true,
  };
}

function formatMatchPointsScore(pointsA: number, pointsB: number): string {
  const format = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
  return `${format(pointsA)}–${format(pointsB)}`;
}

export function formatTournamentTvChampionScoreLine(result: TournamentTvChampionResult): string {
  if (result.retainedOnTie) {
    return `Retained on tie at ${formatMatchPointsScore(result.championPoints, result.opponentPoints)}`;
  }
  return `${formatMatchPointsScore(result.championPoints, result.opponentPoints)} match pts`;
}
