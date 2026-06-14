/**
 * Tournament Service - Multi-day events, teams, and scorecards
 */

import type {
  Tournament,
  TournamentInsert,
  TournamentScore,
  TournamentScoreInsert,
  TournamentTeam,
  TournamentTeamInsert,
} from '@/types';
import {
  isTournamentSupabaseConfigured,
  tournamentSupabaseRequest,
  unwrapList,
  unwrapOk,
  unwrapSingle,
  type TournamentServiceResult,
} from './tournament-supabase';

export type { TournamentServiceError, TournamentServiceResult } from './tournament-supabase';

const isConfigured = isTournamentSupabaseConfigured;

export async function getTournaments(options?: {
  upcomingOnly?: boolean;
  limit?: number;
}): Promise<Tournament[]> {
  const result = await getTournamentsResult(options);
  return unwrapList(result);
}

export async function getTournamentsResult(options?: {
  upcomingOnly?: boolean;
  limit?: number;
}): Promise<TournamentServiceResult<Tournament[]>> {
  if (!isConfigured()) {
    return { data: null, error: 'Supabase is not configured' };
  }

  const query: Record<string, string> = {
    order: 'start_date.asc',
    limit: String(options?.limit ?? 20),
  };

  if (options?.upcomingOnly) {
    query.end_date = `gte.${new Date().toISOString()}`;
  }

  return tournamentSupabaseRequest<Tournament[]>('tournaments', { query });
}

/** Tournament IDs where the member is on a roster, has scores, or a tee time. */
export async function getMyTournamentIds(userId: string): Promise<string[]> {
  if (!isConfigured() || !userId) return [];

  const rosterResult = await tournamentSupabaseRequest<
    Array<{ tournament_id: string; id: string }>
  >('tournament_players', {
    query: {
      user_id: `eq.${userId}`,
      select: 'tournament_id,id',
    },
  });
  const rosterRows = unwrapList(rosterResult);
  const rosterPlayerIds = rosterRows.map((row) => row.id);

  const scoreQueries: Promise<TournamentServiceResult<Array<{ tournament_id: string }>>>[] = [
    tournamentSupabaseRequest('tournament_scores', {
      query: { user_id: `eq.${userId}`, select: 'tournament_id' },
    }),
  ];

  if (rosterPlayerIds.length > 0) {
    scoreQueries.push(
      tournamentSupabaseRequest('tournament_scores', {
        query: {
          tournament_player_id: `in.(${rosterPlayerIds.join(',')})`,
          select: 'tournament_id',
        },
      })
    );
  }

  const [scoreByUser, scoreByRosterPlayer, teeRows, legacyTeamRows] = await Promise.all([
    scoreQueries[0],
    scoreQueries[1] ?? Promise.resolve({ data: [] as Array<{ tournament_id: string }>, error: null }),
    tournamentSupabaseRequest<Array<{ tournament_id: string }>>('tournament_tee_assignments', {
      query: { user_id: `eq.${userId}`, select: 'tournament_id' },
    }),
    tournamentSupabaseRequest<Array<{ tournament_id: string }>>('tournament_teams', {
      query: { player_ids: `cs.{${userId}}`, select: 'tournament_id' },
    }),
  ]);

  const ids = new Set<string>();

  for (const row of rosterRows) ids.add(row.tournament_id);
  for (const row of unwrapList(scoreByUser)) ids.add(row.tournament_id);
  for (const row of unwrapList(scoreByRosterPlayer)) ids.add(row.tournament_id);
  for (const row of unwrapList(teeRows)) ids.add(row.tournament_id);
  for (const row of unwrapList(legacyTeamRows)) ids.add(row.tournament_id);

  return Array.from(ids);
}

export async function isUserRegisteredForTournament(
  userId: string,
  tournamentId: string
): Promise<boolean> {
  const ids = await getMyTournamentIds(userId);
  return ids.includes(tournamentId);
}

/** Managers see all events; members only see tournaments they are registered for. */
export async function getTournamentsForUser(
  userId: string,
  options?: {
    viewAll?: boolean;
    upcomingOnly?: boolean;
    limit?: number;
  }
): Promise<TournamentServiceResult<Tournament[]>> {
  if (!isConfigured()) {
    return { data: null, error: 'Supabase is not configured' };
  }

  if (options?.viewAll) {
    return getTournamentsResult(options);
  }

  const tournamentIds = await getMyTournamentIds(userId);
  if (tournamentIds.length === 0) {
    return { data: [], error: null };
  }

  const query: Record<string, string> = {
    id: `in.(${tournamentIds.join(',')})`,
    order: 'start_date.asc',
    limit: String(options?.limit ?? 30),
  };

  if (options?.upcomingOnly) {
    query.end_date = `gte.${new Date().toISOString()}`;
  }

  return tournamentSupabaseRequest<Tournament[]>('tournaments', { query });
}

export async function getTournamentsForUserList(
  userId: string,
  options?: {
    viewAll?: boolean;
    upcomingOnly?: boolean;
    limit?: number;
  }
): Promise<Tournament[]> {
  const result = await getTournamentsForUser(userId, options);
  return unwrapList(result);
}

export async function getTournamentById(tournamentId: string): Promise<Tournament | null> {
  if (!isConfigured()) return null;

  const result = await tournamentSupabaseRequest<Tournament>('tournaments', {
    query: { id: `eq.${tournamentId}` },
    single: true,
  });

  return unwrapSingle(result);
}

export async function createTournament(
  tournament: TournamentInsert
): Promise<TournamentServiceResult<Tournament>> {
  if (!isConfigured()) {
    return { data: null, error: 'Supabase is not configured' };
  }

  const result = await tournamentSupabaseRequest<Tournament[]>('tournaments', {
    method: 'POST',
    body: tournament as unknown as Record<string, unknown>,
  });

  if (result.error) return result;
  const created = result.data?.[0] ?? null;
  if (!created) {
    return { data: null, error: 'Tournament was not created' };
  }
  return { data: created, error: null };
}

export async function updateTournament(
  tournamentId: string,
  updates: Partial<TournamentInsert>
): Promise<Tournament | null> {
  if (!isConfigured()) return null;

  const result = await tournamentSupabaseRequest<Tournament[]>('tournaments', {
    method: 'PATCH',
    query: { id: `eq.${tournamentId}` },
    body: updates as unknown as Record<string, unknown>,
  });

  return unwrapList(result)[0] ?? null;
}

export async function deleteTournament(tournamentId: string): Promise<boolean> {
  if (!isConfigured()) return false;

  const result = await tournamentSupabaseRequest<Tournament[]>('tournaments', {
    method: 'DELETE',
    query: { id: `eq.${tournamentId}` },
  });

  return unwrapOk(result);
}

// ============================================
// TOURNAMENT TEAMS
// ============================================

export async function getTournamentTeams(tournamentId: string): Promise<TournamentTeam[]> {
  if (!isConfigured()) return [];

  const result = await tournamentSupabaseRequest<TournamentTeam[]>('tournament_teams', {
    query: {
      tournament_id: `eq.${tournamentId}`,
      order: 'team_name.asc',
    },
  });

  return unwrapList(result);
}

export async function getTournamentTeamById(teamId: string): Promise<TournamentTeam | null> {
  if (!isConfigured()) return null;

  const result = await tournamentSupabaseRequest<TournamentTeam>('tournament_teams', {
    query: { id: `eq.${teamId}` },
    single: true,
  });

  return unwrapSingle(result);
}

export async function getTeamsForPlayer(
  tournamentId: string,
  playerId: string
): Promise<TournamentTeam[]> {
  if (!isConfigured()) return [];

  const [teams, directMatch] = await Promise.all([
    getTournamentTeams(tournamentId),
    tournamentSupabaseRequest<TournamentTeam[]>('tournament_teams', {
      query: {
        tournament_id: `eq.${tournamentId}`,
        player_ids: `cs.{${playerId}}`,
      },
    }),
  ]);

  const direct = unwrapList(directMatch);
  if (direct.length > 0) return direct;

  const rosterResult = await tournamentSupabaseRequest<
    Array<{ id: string; user_id: string | null }>
  >('tournament_players', {
    query: {
      tournament_id: `eq.${tournamentId}`,
      user_id: `eq.${playerId}`,
      select: 'id,user_id',
    },
  });

  const rosterPlayers = unwrapList(rosterResult);
  const rosterIds = new Set(rosterPlayers.map((p) => p.id));
  if (rosterIds.size === 0) return [];

  return teams.filter((team) => team.player_ids.some((id) => rosterIds.has(id)));
}

export async function createTournamentTeam(
  team: TournamentTeamInsert
): Promise<TournamentServiceResult<TournamentTeam>> {
  if (!isConfigured()) {
    return { data: null, error: 'Supabase is not configured' };
  }

  const result = await tournamentSupabaseRequest<TournamentTeam[]>('tournament_teams', {
    method: 'POST',
    body: team as unknown as Record<string, unknown>,
  });

  if (result.error) return result;
  const created = result.data?.[0] ?? null;
  if (!created) {
    return { data: null, error: 'Team was not created' };
  }
  return { data: created, error: null };
}

export async function updateTournamentTeam(
  teamId: string,
  updates: Partial<TournamentTeamInsert>
): Promise<TournamentServiceResult<TournamentTeam>> {
  if (!isConfigured()) {
    return { data: null, error: 'Supabase is not configured' };
  }

  const result = await tournamentSupabaseRequest<TournamentTeam[]>('tournament_teams', {
    method: 'PATCH',
    query: { id: `eq.${teamId}` },
    body: updates as unknown as Record<string, unknown>,
  });

  if (result.error) return result;
  const updated = result.data?.[0] ?? null;
  if (!updated) {
    return { data: null, error: 'Team was not updated' };
  }
  return { data: updated, error: null };
}

export async function deleteTournamentTeam(teamId: string): Promise<boolean> {
  if (!isConfigured()) return false;

  const result = await tournamentSupabaseRequest<TournamentTeam[]>('tournament_teams', {
    method: 'DELETE',
    query: { id: `eq.${teamId}` },
  });

  return unwrapOk(result);
}

// ============================================
// TOURNAMENT SCORES
// ============================================

export async function getScoresForMatchGroup(
  matchGroupId: string,
  roundNumber: number
): Promise<TournamentScore[]> {
  if (!isConfigured()) return [];

  const result = await tournamentSupabaseRequest<TournamentScore[]>('tournament_scores', {
    query: {
      match_group_id: `eq.${matchGroupId}`,
      round_number: `eq.${roundNumber}`,
    },
  });

  return unwrapList(result);
}

export async function getTournamentScores(
  tournamentId: string,
  roundNumber?: number
): Promise<TournamentScore[]> {
  if (!isConfigured()) return [];

  const query: Record<string, string> = {
    tournament_id: `eq.${tournamentId}`,
    order: 'round_number.asc,total_net.asc',
  };

  if (roundNumber !== undefined) {
    query.round_number = `eq.${roundNumber}`;
  }

  const result = await tournamentSupabaseRequest<TournamentScore[]>('tournament_scores', { query });
  return unwrapList(result);
}

export async function getTeamRoundScore(
  tournamentId: string,
  teamId: string,
  roundNumber: number
): Promise<TournamentScore | null> {
  if (!isConfigured()) return null;

  const result = await tournamentSupabaseRequest<TournamentScore>('tournament_scores', {
    query: {
      tournament_id: `eq.${tournamentId}`,
      team_id: `eq.${teamId}`,
      round_number: `eq.${roundNumber}`,
    },
    single: true,
  });

  return unwrapSingle(result);
}

export async function getSinglesRoundScore(
  tournamentId: string,
  userId: string,
  roundNumber: number
): Promise<TournamentScore | null> {
  if (!isConfigured()) return null;

  const result = await tournamentSupabaseRequest<TournamentScore>('tournament_scores', {
    query: {
      tournament_id: `eq.${tournamentId}`,
      user_id: `eq.${userId}`,
      round_number: `eq.${roundNumber}`,
    },
    single: true,
  });

  return unwrapSingle(result);
}

export async function getSinglesRoundScoreByTournamentPlayer(
  tournamentId: string,
  tournamentPlayerId: string,
  roundNumber: number
): Promise<TournamentScore | null> {
  if (!isConfigured()) return null;

  const result = await tournamentSupabaseRequest<TournamentScore>('tournament_scores', {
    query: {
      tournament_id: `eq.${tournamentId}`,
      tournament_player_id: `eq.${tournamentPlayerId}`,
      round_number: `eq.${roundNumber}`,
    },
    single: true,
  });

  return unwrapSingle(result);
}

export async function saveTournamentScore(
  score: TournamentScoreInsert
): Promise<TournamentScore | null> {
  if (!isConfigured()) return null;

  const existing = score.team_id
    ? await getTeamRoundScore(score.tournament_id, score.team_id, score.round_number)
    : score.tournament_player_id
      ? await getSinglesRoundScoreByTournamentPlayer(
          score.tournament_id,
          score.tournament_player_id,
          score.round_number
        )
      : score.user_id
        ? await getSinglesRoundScore(score.tournament_id, score.user_id, score.round_number)
        : null;

  if (existing) {
    const result = await tournamentSupabaseRequest<TournamentScore[]>('tournament_scores', {
      method: 'PATCH',
      query: { id: `eq.${existing.id}` },
      body: {
        hole_scores: score.hole_scores,
        total_gross: score.total_gross,
        total_net: score.total_net,
      },
    });
    return unwrapList(result)[0] ?? null;
  }

  const result = await tournamentSupabaseRequest<TournamentScore[]>('tournament_scores', {
    method: 'POST',
    body: score as unknown as Record<string, unknown>,
  });

  return unwrapList(result)[0] ?? null;
}

export async function deleteTournamentScore(scoreId: string): Promise<boolean> {
  if (!isConfigured()) return false;

  const result = await tournamentSupabaseRequest<TournamentScore[]>('tournament_scores', {
    method: 'DELETE',
    query: { id: `eq.${scoreId}` },
  });

  return unwrapOk(result);
}

/**
 * Aggregate leaderboard totals across all rounds for a tournament.
 */
export function buildTournamentLeaderboard(
  scores: TournamentScore[],
  mode: 'gross' | 'net' = 'net'
): { key: string; total_gross: number; total_net: number; rounds_played: number }[] {
  const totals = new Map<string, { total_gross: number; total_net: number; rounds_played: number }>();

  for (const score of scores) {
    const key = score.team_id ?? score.tournament_player_id ?? score.user_id ?? score.id;
    const current = totals.get(key) ?? { total_gross: 0, total_net: 0, rounds_played: 0 };

    totals.set(key, {
      total_gross: current.total_gross + score.total_gross,
      total_net: current.total_net + score.total_net,
      rounds_played: current.rounds_played + 1,
    });
  }

  return Array.from(totals.entries())
    .map(([key, stats]) => ({ key, ...stats }))
    .sort((a, b) =>
      mode === 'gross' ? a.total_gross - b.total_gross : a.total_net - b.total_net
    );
}

export function isTournamentServiceConfigured(): boolean {
  return isConfigured();
}
