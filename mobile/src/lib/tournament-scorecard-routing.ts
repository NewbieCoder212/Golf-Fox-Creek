import type { Tournament, TournamentMatchGroup, TournamentTeamSide } from '@/types';
import { formatClubTime } from './club-timezone';
import { getTournamentById } from './tournament-service';
import { getTournamentMatchGroups } from './tournament-match-service';
import { getTournamentRosterPlayerIdsForUser } from './tournament-player-service';
import { getMatchGroupFormat, isFoursomePlayerScorecardFormat, isSideScopedTeamFormat } from './tournament-labels';

export const SCORECARD_OPEN_MINUTES_BEFORE_TEE = 30;

export interface ScorecardTimeGateParams {
  tournament: Pick<Tournament, 'start_date' | 'end_date'>;
  matchGroup?: Pick<TournamentMatchGroup, 'tee_time'> | null;
  now?: Date;
  bypassTimeGate?: boolean;
}

/** Soft UI gate: event day + 30 minutes before assigned tee time (managers may bypass). */
export function isScorecardTimeGateOpen(params: ScorecardTimeGateParams): boolean {
  if (params.bypassTimeGate) return true;

  const now = params.now ?? new Date();
  if (!isTournamentActiveToday(params.tournament.start_date, params.tournament.end_date, now)) {
    return false;
  }

  const teeTime = params.matchGroup?.tee_time;
  if (!teeTime) return true;

  const openAtMs =
    new Date(teeTime).getTime() - SCORECARD_OPEN_MINUTES_BEFORE_TEE * 60_000;
  return now.getTime() >= openAtMs;
}

export function getScorecardClosedHint(params: ScorecardTimeGateParams): string {
  if (params.bypassTimeGate) return '';

  const now = params.now ?? new Date();
  if (!isTournamentActiveToday(params.tournament.start_date, params.tournament.end_date, now)) {
    return 'Score entry opens on event day, 30 minutes before your tee time.';
  }

  const teeTime = params.matchGroup?.tee_time;
  if (!teeTime) {
    return 'Score entry opens on event day.';
  }

  const openAtMs =
    new Date(teeTime).getTime() - SCORECARD_OPEN_MINUTES_BEFORE_TEE * 60_000;
  const opensAtLabel = formatClubTime(new Date(openAtMs).toISOString(), true);
  return `Score entry opens at ${opensAtLabel} (30 min before tee).`;
}

/** Pick the round for today's calendar day within the tournament schedule. */
export function getActiveRoundNumber(
  tournament: Pick<Tournament, 'start_date' | 'round_schedule' | 'rounds_count'>
): number {
  const start = new Date(tournament.start_date);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayOffset = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  if (dayOffset < 0) return 1;

  let roundCounter = 0;
  for (let dayIndex = 0; dayIndex < tournament.round_schedule.length; dayIndex++) {
    const day = tournament.round_schedule[dayIndex];
    if (dayIndex === dayOffset) {
      return roundCounter + 1;
    }
    roundCounter += day.formats.length;
  }

  return tournament.rounds_count;
}

export function isTournamentActiveToday(
  startDate: string,
  endDate: string,
  now: Date = new Date()
): boolean {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return now >= start && now <= end;
}

export function pickHubLeaderboardTournamentId<
  T extends { id: string; start_date: string; end_date: string }
>(tournaments: T[]): string | undefined {
  const active = tournaments.filter((tournament) =>
    isTournamentActiveToday(tournament.start_date, tournament.end_date)
  );
  if (active.length > 0) return active[0].id;
  return tournaments[0]?.id;
}

export function findMatchGroupForRosterPlayer(
  groups: TournamentMatchGroup[],
  rosterPlayerIds: string[],
  roundNumber?: number
): { group: TournamentMatchGroup; side: TournamentTeamSide } | null {
  if (rosterPlayerIds.length === 0) return null;

  const idSet = new Set(rosterPlayerIds);
  const candidates = roundNumber
    ? groups.filter((group) => group.round_number === roundNumber)
    : groups;

  for (const group of candidates) {
    if (group.side_a_player_ids.some((playerId) => idSet.has(playerId))) {
      return { group, side: 'side_a' };
    }
    if (group.side_b_player_ids.some((playerId) => idSet.has(playerId))) {
      return { group, side: 'side_b' };
    }
  }

  return null;
}

export function buildTournamentScorecardPath(params: {
  tournamentId: string;
  tournament: Tournament;
  rosterPlayerIds: string[];
  matchGroups: TournamentMatchGroup[];
  roundNumber?: number;
}): string {
  const round = params.roundNumber ?? getActiveRoundNumber(params.tournament);
  const match = findMatchGroupForRosterPlayer(
    params.matchGroups,
    params.rosterPlayerIds,
    round
  );

  const search = new URLSearchParams({ id: params.tournamentId });

  if (match) {
    const format = getMatchGroupFormat(match.group, params.tournament);
    search.set('matchGroupId', match.group.id);
    search.set('round', String(match.group.round_number));
    if (isSideScopedTeamFormat(format) || isFoursomePlayerScorecardFormat(format)) {
      search.set('side', match.side);
    }
  } else {
    search.set('round', String(round));
  }

  return `/(tabs)/scorecard?${search.toString()}`;
}

/** Resolve the best scorecard route for a logged-in member (foursome + tee time when assigned). */
export async function resolveTournamentScorecardRoute(
  tournamentId: string,
  userId: string,
  roundNumber?: number
): Promise<string> {
  const [tournament, matchGroups, rosterPlayerIds] = await Promise.all([
    getTournamentById(tournamentId),
    getTournamentMatchGroups(tournamentId),
    getTournamentRosterPlayerIdsForUser(tournamentId, userId),
  ]);

  if (!tournament) {
    return `/(tabs)/scorecard?id=${tournamentId}`;
  }

  return buildTournamentScorecardPath({
    tournamentId,
    tournament,
    rosterPlayerIds,
    matchGroups,
    roundNumber,
  });
}

export function formatTeeTimeLabel(iso: string): string {
  return formatClubTime(iso, true);
}
