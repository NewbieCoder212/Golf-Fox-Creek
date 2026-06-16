import type { Tournament, TournamentMatchGroup, TournamentTeamSide } from '@/types';
import { getTournamentById } from './tournament-service';
import { getTournamentMatchGroups } from './tournament-match-service';
import { getTournamentRosterPlayerIdsForUser } from './tournament-player-service';
import { getMatchGroupFormat, isSinglesFormat } from './tournament-labels';

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

  if (roundNumber !== undefined) {
    return findMatchGroupForRosterPlayer(groups, rosterPlayerIds);
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
    if (!isSinglesFormat(format)) {
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

import { formatClubTime } from './club-timezone';

export function formatTeeTimeLabel(iso: string): string {
  return formatClubTime(iso, true);
}
