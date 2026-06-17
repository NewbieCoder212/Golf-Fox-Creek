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

type MemberLookup = { id: string; email?: string | null; full_name?: string | null };

export function findMemberIdByEmail(
  members: MemberLookup[],
  email: string | null | undefined
): string | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  return members.find((entry) => entry.email?.trim().toLowerCase() === normalized)?.id ?? null;
}

/** Map a roster player to user_profiles.id for captain assignment. */
export function resolveCaptainUserIdForPlayer(
  player: Pick<TournamentPlayer, 'user_id' | 'email'>,
  members: MemberLookup[],
  memberEmailByUserId: Record<string, string> = {}
): string | null {
  if (player.user_id) return player.user_id;

  const email = resolveParticipantEmail(player, memberEmailByUserId)?.trim().toLowerCase();
  if (!email) return null;

  return findMemberIdByEmail(members, email);
}

export function inferParticipantUserId(
  members: MemberLookup[],
  params: { email?: string | null; display_name?: string | null }
): string | null {
  const byEmail = findMemberIdByEmail(members, params.email);
  if (byEmail) return byEmail;

  const normalizedName = params.display_name?.trim().toLowerCase();
  if (!normalizedName) return null;

  const nameMatches = members.filter(
    (member) => member.full_name?.trim().toLowerCase() === normalizedName
  );
  return nameMatches.length === 1 ? nameMatches[0].id : null;
}

export function isCaptainPlayer(
  player: Pick<TournamentPlayer, 'user_id' | 'email'>,
  captainUserId: string | null | undefined,
  members: MemberLookup[],
  memberEmailByUserId: Record<string, string> = {}
): boolean {
  if (!captainUserId) return false;
  return resolveCaptainUserIdForPlayer(player, members, memberEmailByUserId) === captainUserId;
}

export function resolveTeamCaptainPlayer(
  team: Pick<TournamentTeam, 'captain_user_id' | 'captain_player_id'>,
  teamRoster: TournamentPlayer[],
  members: MemberLookup[],
  memberEmailByUserId: Record<string, string> = {}
): TournamentPlayer | null {
  if (team.captain_player_id) {
    return teamRoster.find((player) => player.id === team.captain_player_id) ?? null;
  }

  if (!team.captain_user_id) return null;

  return (
    teamRoster.find(
      (player) =>
        resolveCaptainUserIdForPlayer(player, members, memberEmailByUserId) === team.captain_user_id
    ) ?? null
  );
}

export function buildCaptainTeamUpdate(
  player: TournamentPlayer,
  members: MemberLookup[],
  memberEmailByUserId: Record<string, string> = {}
): Pick<TournamentTeam, 'captain_player_id' | 'captain_user_id'> {
  return {
    captain_player_id: player.id,
    captain_user_id: resolveCaptainUserIdForPlayer(player, members, memberEmailByUserId),
  };
}

export function validateCaptainPlayerOnTeam(
  team: Pick<TournamentTeam, 'player_ids'>,
  player: Pick<TournamentPlayer, 'id' | 'user_id'>,
  participants: TournamentPlayer[] = []
): boolean {
  if (participants.length > 0) {
    return resolveTeamParticipants(team, participants).some((entry) => entry.id === player.id);
  }
  return (
    team.player_ids.includes(player.id) ||
    (player.user_id != null && team.player_ids.includes(player.user_id))
  );
}

export function isTeamCaptainPlayer(
  team: Pick<TournamentTeam, 'captain_user_id' | 'captain_player_id'>,
  player: Pick<TournamentPlayer, 'id' | 'user_id' | 'email'>,
  members: MemberLookup[],
  memberEmailByUserId: Record<string, string> = {}
): boolean {
  if (team.captain_player_id) {
    return team.captain_player_id === player.id;
  }
  return isCaptainPlayer(player, team.captain_user_id, members, memberEmailByUserId);
}

export function resolveCaptainDisplayName(
  team: Pick<TournamentTeam, 'captain_user_id' | 'captain_player_id'>,
  teamRoster: TournamentPlayer[],
  members: Array<{ id: string; full_name?: string | null; email?: string | null }>,
  memberEmailByUserId: Record<string, string> = {}
): string | null {
  const captainPlayer = resolveTeamCaptainPlayer(team, teamRoster, members, memberEmailByUserId);
  if (captainPlayer) return captainPlayer.display_name;

  if (!team.captain_user_id) return null;

  const member = members.find((entry) => entry.id === team.captain_user_id);
  return member?.full_name?.trim() || member?.email || null;
}

export function teamHasCaptain(
  team: Pick<TournamentTeam, 'captain_user_id' | 'captain_player_id'>
): boolean {
  return Boolean(team.captain_player_id || team.captain_user_id);
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
