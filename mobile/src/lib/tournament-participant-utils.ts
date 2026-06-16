import type { TournamentPlayer, TournamentTeam } from '@/types';

function findParticipantForRosterId(
  rosterId: string,
  participants: TournamentPlayer[]
): TournamentPlayer | undefined {
  const byId = participants.find((p) => p.id === rosterId);
  if (byId) return byId;
  return participants.find((p) => p.user_id === rosterId);
}

/** Resolve team roster IDs to current participant records (handles legacy member user_ids). */
export function resolveTeamParticipants(
  team: Pick<TournamentTeam, 'player_ids'>,
  participants: TournamentPlayer[]
): TournamentPlayer[] {
  const seen = new Set<string>();
  const result: TournamentPlayer[] = [];

  for (const rosterId of team.player_ids) {
    const player = findParticipantForRosterId(rosterId, participants);
    if (!player || seen.has(player.id)) continue;
    seen.add(player.id);
    result.push(player);
  }

  return result;
}

/** Normalize roster IDs to canonical tournament_players.id; drop stale/orphan IDs. */
export function sanitizeTeamPlayerIds(
  playerIds: string[],
  participants: TournamentPlayer[]
): string[] {
  return resolveTeamParticipants({ player_ids: playerIds }, participants).map((p) => p.id);
}

export function playerIdsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

export function getAssignedPlayerIds(
  teams: TournamentTeam[],
  participants?: TournamentPlayer[]
): Set<string> {
  if (participants) {
    const assigned = new Set<string>();
    for (const team of teams) {
      for (const player of resolveTeamParticipants(team, participants)) {
        assigned.add(player.id);
      }
    }
    return assigned;
  }

  return new Set(teams.flatMap((team) => team.player_ids));
}

export function getUnassignedPlayers(
  players: TournamentPlayer[],
  teams: TournamentTeam[]
): TournamentPlayer[] {
  const assigned = getAssignedPlayerIds(teams, players);
  return players.filter((player) => !assigned.has(player.id));
}

export function getTeamForPlayer(
  player: Pick<TournamentPlayer, 'id' | 'user_id'>,
  teams: TournamentTeam[]
): TournamentTeam | null {
  return (
    teams.find(
      (team) =>
        team.player_ids.includes(player.id) ||
        (player.user_id != null && team.player_ids.includes(player.user_id))
    ) ?? null
  );
}

export function countTeamsWithResolvedPlayers(
  teams: TournamentTeam[],
  participants: TournamentPlayer[]
): number {
  return teams.filter((team) => resolveTeamParticipants(team, participants).length > 0).length;
}

export function resolveParticipantEmail(
  player: TournamentPlayer,
  memberEmailByUserId: Record<string, string>
): string | null {
  if (player.user_id && memberEmailByUserId[player.user_id]) {
    return memberEmailByUserId[player.user_id];
  }
  const direct = player.email?.trim();
  return direct || null;
}

export function splitName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Member', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
