/**
 * Tournament roster players — named entries for teams (members or guests).
 */

import type { TournamentPlayer, TournamentPlayerInsert, TournamentTeam, TournamentTeamInsert } from '@/types';
import {
  requireData,
  tournamentSupabaseRequest,
  unwrapList,
  type TournamentServiceResult,
} from './tournament-supabase';
import { createTournamentTeam, updateTournamentTeam } from './tournament-service';

export async function getTournamentPlayers(tournamentId: string): Promise<TournamentPlayer[]> {
  const result = await tournamentSupabaseRequest<TournamentPlayer[]>('tournament_players', {
    query: {
      tournament_id: `eq.${tournamentId}`,
      order: 'display_name.asc',
    },
  });
  return unwrapList(result);
}

export async function getTournamentRosterPlayerIdsForUser(
  tournamentId: string,
  userId: string
): Promise<string[]> {
  const players = await getTournamentPlayers(tournamentId);
  return players.filter((player) => player.user_id === userId).map((player) => player.id);
}

export async function createTournamentPlayer(
  player: TournamentPlayerInsert
): Promise<TournamentServiceResult<TournamentPlayer>> {
  const result = await tournamentSupabaseRequest<TournamentPlayer[]>('tournament_players', {
    method: 'POST',
    body: player as unknown as Record<string, unknown>,
  });

  if (result.error) return result;
  const created = result.data?.[0] ?? null;
  if (!created) {
    return { data: null, error: 'Player was not created' };
  }
  return { data: created, error: null };
}

export async function createTournamentPlayers(
  tournamentId: string,
  players: Omit<TournamentPlayerInsert, 'tournament_id'>[]
): Promise<TournamentServiceResult<TournamentPlayer[]>> {
  if (players.length === 0) {
    return { data: null, error: 'Add at least one player to the roster' };
  }

  const rows = players.map((player) => ({
    tournament_id: tournamentId,
    display_name: player.display_name.trim(),
    handicap_index: player.handicap_index ?? null,
    user_id: player.user_id ?? null,
  }));

  const result = await tournamentSupabaseRequest<TournamentPlayer[]>('tournament_players', {
    method: 'POST',
    body: rows as unknown as Record<string, unknown>[],
  });

  if (result.error) return result;
  const created = result.data ?? [];
  if (created.length === 0) {
    return { data: null, error: 'Players were not created' };
  }
  return { data: created, error: null };
}

export async function deleteTournamentPlayer(
  playerId: string
): Promise<TournamentServiceResult<boolean>> {
  const result = await tournamentSupabaseRequest<TournamentPlayer[]>('tournament_players', {
    method: 'DELETE',
    query: { id: `eq.${playerId}` },
  });

  if (result.error) return { data: null, error: result.error };
  return { data: true, error: null };
}

export async function appendPlayersToTeam(
  team: TournamentTeam,
  players: Omit<TournamentPlayerInsert, 'tournament_id'>[]
): Promise<TournamentServiceResult<TournamentTeam>> {
  const createdResult = await createTournamentPlayers(team.tournament_id, players);
  if (createdResult.error) return { data: null, error: createdResult.error };

  const created = createdResult.data ?? [];
  const updates: Partial<TournamentTeamInsert> & {
    roster_status?: TournamentTeam['roster_status'];
    onboard_email_sent_at?: string | null;
  } = {
    player_ids: [...team.player_ids, ...created.map((p) => p.id)],
  };
  if ((team.roster_status ?? 'draft') === 'ready') {
    updates.roster_status = 'draft';
    updates.onboard_email_sent_at = null;
  }
  return updateTournamentTeam(team.id, updates);
}

export async function removePlayerFromTeam(
  team: TournamentTeam,
  playerId: string
): Promise<TournamentServiceResult<TournamentTeam>> {
  const nextIds = team.player_ids.filter((id) => id !== playerId);
  if (nextIds.length === 0) {
    return { data: null, error: 'A team must have at least one player' };
  }

  const updates: Partial<TournamentTeamInsert> & {
    roster_status?: TournamentTeam['roster_status'];
    onboard_email_sent_at?: string | null;
  } = { player_ids: nextIds };
  if ((team.roster_status ?? 'draft') === 'ready') {
    updates.roster_status = 'draft';
    updates.onboard_email_sent_at = null;
  }

  return updateTournamentTeam(team.id, updates);
}

export function buildTournamentPlayerMaps(
  tournamentPlayers: TournamentPlayer[],
  members: Array<{ id: string; full_name: string; handicap_index?: number | null }>
): {
  nameById: Record<string, string>;
  handicapById: Record<string, number>;
} {
  const nameById: Record<string, string> = {};
  const handicapById: Record<string, number> = {};

  for (const player of tournamentPlayers) {
    nameById[player.id] = player.display_name;
    handicapById[player.id] = player.handicap_index ?? 0;
  }

  for (const member of members) {
    if (!nameById[member.id]) {
      nameById[member.id] = member.full_name;
    }
    if (handicapById[member.id] === undefined) {
      handicapById[member.id] = member.handicap_index ?? 0;
    }
  }

  return { nameById, handicapById };
}

export function resolveRosterEntries(
  playerIds: string[],
  tournamentPlayers: TournamentPlayer[],
  members: Array<{ id: string; full_name: string; handicap_index?: number | null }>
): Array<{ id: string; display_name: string; handicap_index: number; user_id?: string | null }> {
  const { nameById, handicapById } = buildTournamentPlayerMaps(tournamentPlayers, members);
  const playerById = Object.fromEntries(tournamentPlayers.map((p) => [p.id, p]));

  return playerIds.map((id) => {
    const rosterPlayer = playerById[id];
    return {
      id,
      display_name: nameById[id] ?? 'Player',
      handicap_index: rosterPlayer?.handicap_index ?? handicapById[id] ?? 0,
      user_id: rosterPlayer?.user_id ?? (members.some((m) => m.id === id) ? id : null),
    };
  });
}

export function findPlayerIdsForUser(
  userId: string,
  tournamentPlayers: TournamentPlayer[]
): Set<string> {
  const ids = new Set<string>([userId]);
  for (const player of tournamentPlayers) {
    if (player.user_id === userId) {
      ids.add(player.id);
    }
  }
  return ids;
}

/** Throws with a user-facing message when any step fails. */
export async function createTournamentTeamWithRoster(params: {
  tournament_id: string;
  team_name: string;
  side: TournamentTeamInsert['side'];
  captain_user_id?: string | null;
  roster: Array<{
    display_name: string;
    handicap_index: number;
    user_id?: string | null;
  }>;
}): Promise<TournamentTeam> {
  const playersResult = await createTournamentPlayers(
    params.tournament_id,
    params.roster.map((entry) => ({
      display_name: entry.display_name,
      handicap_index: entry.handicap_index,
      user_id: entry.user_id ?? null,
    }))
  );
  const players = requireData(playersResult, 'Could not create players');

  const teamResult = await createTournamentTeam({
    tournament_id: params.tournament_id,
    team_name: params.team_name,
    side: params.side,
    player_ids: players.map((player) => player.id),
    captain_user_id: params.captain_user_id ?? null,
    roster_status: 'draft',
  });

  return requireData(teamResult, 'Could not create team');
}
