/**
 * TV display helpers — current round from schedule + tee times (club timezone).
 */

import type { Tournament, TournamentMatchGroup } from '@/types';
import { clubDateInputValue } from './club-timezone';
import { getActiveRoundNumber } from './tournament-scorecard-routing';

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
