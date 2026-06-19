/**
 * Tournament Service - Multi-day events, teams, and scorecards
 */

import type {
  Tournament,
  TournamentInsert,
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentScore,
  TournamentScoreInsert,
  TournamentTeam,
  TournamentTeamInsert,
} from '@/types';
import { buildMatchStatusFromHoleResults } from './tournament-match-play-status';
import { getTeamSideDisplayName } from './tournament-labels';
import {
  getManagerAccessToken,
  isTournamentSupabaseConfigured,
  tournamentSupabaseRequest,
  unwrapList,
  unwrapOk,
  unwrapSingle,
  type TournamentServiceResult,
} from './tournament-supabase';
import { useMemberAuthStore } from './member-auth-store';
import { updateTournamentTeamViaBackend } from './tournament-team-service';

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
export async function getMyTournamentIds(
  userId: string,
  options?: { email?: string | null }
): Promise<string[]> {
  if (!isConfigured() || !userId) return [];

  const memberToken = useMemberAuthStore.getState().accessToken;
  const readAuth = memberToken ? { accessToken: memberToken } : {};

  const rosterResult = await tournamentSupabaseRequest<
    Array<{ tournament_id: string; id: string }>
  >('tournament_players', {
    ...readAuth,
    query: {
      user_id: `eq.${userId}`,
      select: 'tournament_id,id',
    },
  });

  if (rosterResult.error) {
    console.log('[Tournament] getMyTournamentIds roster read failed:', rosterResult.error);
  }

  let rosterRows = unwrapList(rosterResult);

  const memberEmail = options?.email?.trim().toLowerCase();
  if (rosterRows.length === 0 && memberEmail) {
    const byEmailResult = await tournamentSupabaseRequest<
      Array<{ tournament_id: string; id: string }>
    >('tournament_players', {
      ...readAuth,
      query: {
        email: `eq.${memberEmail}`,
        select: 'tournament_id,id',
      },
    });
    if (byEmailResult.error) {
      console.log('[Tournament] getMyTournamentIds email roster read failed:', byEmailResult.error);
    }
    rosterRows = unwrapList(byEmailResult);
  }

  const rosterPlayerIds = rosterRows.map((row) => row.id);

  const scoreQueries: Promise<TournamentServiceResult<Array<{ tournament_id: string }>>>[] = [
    tournamentSupabaseRequest('tournament_scores', {
      ...readAuth,
      query: { user_id: `eq.${userId}`, select: 'tournament_id' },
    }),
  ];

  if (rosterPlayerIds.length > 0) {
    scoreQueries.push(
      tournamentSupabaseRequest('tournament_scores', {
        ...readAuth,
        query: {
          tournament_player_id: `in.(${rosterPlayerIds.join(',')})`,
          select: 'tournament_id',
        },
      })
    );
  }

  const [scoreByUser, scoreByRosterPlayer, teeRows, legacyTeamRows, captainTeamRows] = await Promise.all([
    scoreQueries[0],
    scoreQueries[1] ?? Promise.resolve({ data: [] as Array<{ tournament_id: string }>, error: null }),
    tournamentSupabaseRequest<Array<{ tournament_id: string }>>('tournament_tee_assignments', {
      ...readAuth,
      query: { user_id: `eq.${userId}`, select: 'tournament_id' },
    }),
    tournamentSupabaseRequest<Array<{ tournament_id: string }>>('tournament_teams', {
      ...readAuth,
      query: { player_ids: `cs.{${userId}}`, select: 'tournament_id' },
    }),
    tournamentSupabaseRequest<Array<{ tournament_id: string }>>('tournament_teams', {
      ...readAuth,
      query: { captain_user_id: `eq.${userId}`, select: 'tournament_id' },
    }),
  ]);

  const ids = new Set<string>();

  for (const row of rosterRows) ids.add(row.tournament_id);
  for (const row of unwrapList(scoreByUser)) ids.add(row.tournament_id);
  for (const row of unwrapList(scoreByRosterPlayer)) ids.add(row.tournament_id);
  for (const row of unwrapList(teeRows)) ids.add(row.tournament_id);
  for (const row of unwrapList(legacyTeamRows)) ids.add(row.tournament_id);
  for (const row of unwrapList(captainTeamRows)) ids.add(row.tournament_id);

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

  const tournamentIds = await getMyTournamentIds(userId, {
    email: useMemberAuthStore.getState().user?.email,
  });
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

  return unwrapList(result).map((team) => ({
    ...team,
    captain_user_id: team.captain_user_id ?? null,
    captain_player_id: team.captain_player_id ?? null,
    roster_status: team.roster_status ?? 'draft',
    roster_ready_at: team.roster_ready_at ?? null,
    roster_ready_by: team.roster_ready_by ?? null,
    onboard_email_sent_at: team.onboard_email_sent_at ?? null,
  }));
}

export async function getTournamentTeamById(teamId: string): Promise<TournamentTeam | null> {
  if (!isConfigured()) return null;

  const result = await tournamentSupabaseRequest<TournamentTeam>('tournament_teams', {
    query: { id: `eq.${teamId}` },
    single: true,
  });

  const team = unwrapSingle(result);
  if (!team) return null;

  return {
    ...team,
    captain_user_id: team.captain_user_id ?? null,
    captain_player_id: team.captain_player_id ?? null,
    roster_status: team.roster_status ?? 'draft',
  };
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
  updates: Partial<
    TournamentTeamInsert &
      Pick<
        TournamentTeam,
        'roster_status' | 'roster_ready_at' | 'roster_ready_by' | 'onboard_email_sent_at'
      >
  >,
  context?: { tournamentId?: string; accessToken?: string }
): Promise<TournamentServiceResult<TournamentTeam>> {
  if (!isConfigured()) {
    return { data: null, error: 'Supabase is not configured' };
  }

  const managerToken = context?.accessToken ?? getManagerAccessToken();
  const isCaptainUpdate = 'captain_player_id' in updates;

  const canUseBackend =
    Boolean(context?.tournamentId && managerToken) &&
    !('roster_status' in updates) &&
    !('roster_ready_at' in updates) &&
    !('roster_ready_by' in updates) &&
    !('onboard_email_sent_at' in updates) &&
    ('team_name' in updates ||
      'captain_user_id' in updates ||
      'captain_player_id' in updates ||
      'player_ids' in updates);

  if (canUseBackend && context?.tournamentId && managerToken) {
    const backendResult = await updateTournamentTeamViaBackend({
      tournamentId: context.tournamentId,
      teamId,
      accessToken: managerToken,
      updates: {
        ...(typeof updates.team_name === 'string' ? { team_name: updates.team_name } : {}),
        ...('captain_user_id' in updates ? { captain_user_id: updates.captain_user_id ?? null } : {}),
        ...('captain_player_id' in updates
          ? { captain_player_id: updates.captain_player_id ?? null }
          : {}),
        ...('player_ids' in updates && Array.isArray(updates.player_ids)
          ? { player_ids: updates.player_ids }
          : {}),
      },
    });

    if (backendResult.data) {
      const sentCaptainPlayerId =
        'captain_player_id' in updates ? updates.captain_player_id ?? null : undefined;
      if (
        sentCaptainPlayerId === undefined ||
        backendResult.data.captain_player_id === sentCaptainPlayerId
      ) {
        return { data: backendResult.data, error: null };
      }
    }

    if (isCaptainUpdate && backendResult.error) {
      const unreachable = backendResult.error === 'Could not reach tournament service';
      if (!unreachable) {
        return { data: null, error: backendResult.error };
      }
    }
  }

  const result = await tournamentSupabaseRequest<TournamentTeam[]>('tournament_teams', {
    method: 'PATCH',
    query: { id: `eq.${teamId}` },
    body: updates as unknown as Record<string, unknown>,
    accessToken: managerToken,
  });

  if (result.error) return result;

  let updated = result.data?.[0] ?? null;
  if (!updated) {
    updated = await getTournamentTeamById(teamId);
  }

  if (!updated) {
    return { data: null, error: 'Team was not updated. Check your login session and try again.' };
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
  score: TournamentScoreInsert,
  options?: { accessToken?: string | null }
): Promise<TournamentServiceResult<TournamentScore>> {
  if (!isConfigured()) {
    return { data: null, error: 'Supabase is not configured' };
  }

  const writeAuth = options?.accessToken ? { accessToken: options.accessToken } : {};

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
        match_group_id: score.match_group_id ?? existing.match_group_id,
      },
      ...writeAuth,
    });
    if (result.error) return { data: null, error: result.error };
    const saved = unwrapList(result)[0] ?? null;
    if (!saved) return { data: null, error: 'Score update returned no data' };
    return { data: saved, error: null };
  }

  const result = await tournamentSupabaseRequest<TournamentScore[]>('tournament_scores', {
    method: 'POST',
    body: score as unknown as Record<string, unknown>,
    ...writeAuth,
  });

  if (result.error) return { data: null, error: result.error };
  const saved = unwrapList(result)[0] ?? null;
  if (!saved) return { data: null, error: 'Score insert returned no data' };
  return { data: saved, error: null };
}

export async function deleteTournamentScore(scoreId: string): Promise<boolean> {
  if (!isConfigured()) return false;

  const result = await tournamentSupabaseRequest<TournamentScore[]>('tournament_scores', {
    method: 'DELETE',
    query: { id: `eq.${scoreId}` },
  });

  return unwrapOk(result);
}

export async function deleteTournamentScoresForMatchRound(
  matchGroupId: string,
  roundNumber: number
): Promise<{ success: boolean; error?: string }> {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase is not configured' };
  }

  const result = await tournamentSupabaseRequest<unknown>('tournament_scores', {
    method: 'DELETE',
    query: {
      match_group_id: `eq.${matchGroupId}`,
      round_number: `eq.${roundNumber}`,
    },
  });

  if (result.error) return { success: false, error: result.error };
  return { success: true };
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

export interface MatchPointsStanding {
  teamId: string;
  teamName: string;
  side: 'side_a' | 'side_b';
  matchPoints: number;
  matchesWon: number;
  matchesPlayed: number;
}

export function buildMatchPointsLeaderboard(
  teams: { id: string; team_name: string; side: string | null }[],
  matchGroups: {
    side_a_team_id: string;
    side_b_team_id: string;
    match_points_a?: number;
    match_points_b?: number;
    match_winner?: string | null;
  }[]
): MatchPointsStanding[] {
  const byTeamId = new Map<string, MatchPointsStanding>();

  for (const team of teams) {
    if (!team.side) continue;
    byTeamId.set(team.id, {
      teamId: team.id,
      teamName: team.team_name,
      side: team.side as 'side_a' | 'side_b',
      matchPoints: 0,
      matchesWon: 0,
      matchesPlayed: 0,
    });
  }

  for (const group of matchGroups) {
    if (group.match_winner == null) continue;

    const pointsA = Number(group.match_points_a ?? 0);
    const pointsB = Number(group.match_points_b ?? 0);
    if (pointsA === 0 && pointsB === 0) continue;

    const teamA = byTeamId.get(group.side_a_team_id);
    const teamB = byTeamId.get(group.side_b_team_id);

    if (teamA) {
      teamA.matchPoints += pointsA;
      teamA.matchesPlayed += 1;
      if (group.match_winner === 'side_a') teamA.matchesWon += 1;
    }
    if (teamB) {
      teamB.matchPoints += pointsB;
      teamB.matchesPlayed += 1;
      if (group.match_winner === 'side_b') teamB.matchesWon += 1;
    }
  }

  return Array.from(byTeamId.values()).sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    return b.matchesWon - a.matchesWon;
  });
}

/** Team standings from groups that are actually complete (ignores stale winner flags). */
export function buildMatchPointsLeaderboardFromHoleResults(
  teams: { id: string; team_name: string; side: string | null }[],
  matchGroups: TournamentMatchGroup[],
  holeResults: TournamentMatchHoleResult[]
): MatchPointsStanding[] {
  const sideAName = getTeamSideDisplayName('side_a', teams as TournamentTeam[]);
  const sideBName = getTeamSideDisplayName('side_b', teams as TournamentTeam[]);

  const completedGroups = matchGroups.filter((group) => {
    const { playStatus } = buildMatchStatusFromHoleResults(
      group,
      holeResults,
      sideAName,
      sideBName
    );
    return playStatus === 'complete';
  });

  return buildMatchPointsLeaderboard(teams, completedGroups);
}

export function isTournamentServiceConfigured(): boolean {
  return isConfigured();
}
