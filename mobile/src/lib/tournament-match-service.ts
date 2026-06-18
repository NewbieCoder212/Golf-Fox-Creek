/**
 * Tournament match groups — 2v2 pairings (side A vs side B per tee time)
 */

import type {
  TournamentMatchGroup,
  TournamentMatchGroupInsert,
  TournamentMatchHoleResult,
  TournamentMatchHoleWinner,
  TournamentFormat,
  TournamentScore,
} from '@/types';
import { useMemberAuthStore } from './member-auth-store';
import { deleteTournamentScoresForMatchRound } from './tournament-service';
import { computeMatchHoleResults, computeMatchPoints } from './tournament-match-scoring';
import {
  getManagerAccessToken,
  requireData,
  tournamentSupabaseRequest,
  type TournamentServiceResult,
  unwrapList,
} from './tournament-supabase';

function matchGroupsQuery(
  tournamentId: string,
  roundNumber?: number
): Record<string, string> {
  const query: Record<string, string> = {
    tournament_id: `eq.${tournamentId}`,
    order: 'round_number.asc,tee_time.asc,group_number.asc',
  };
  if (roundNumber !== undefined) {
    query.round_number = `eq.${roundNumber}`;
  }
  return query;
}

export async function getTournamentMatchGroupsResult(
  tournamentId: string,
  roundNumber?: number
): Promise<TournamentServiceResult<TournamentMatchGroup[]>> {
  return tournamentSupabaseRequest<TournamentMatchGroup[]>('tournament_match_groups', {
    query: matchGroupsQuery(tournamentId, roundNumber),
  });
}

/** Throws on load failure — use in React Query or try/catch. Never returns [] on error. */
export async function getTournamentMatchGroups(
  tournamentId: string,
  roundNumber?: number
): Promise<TournamentMatchGroup[]> {
  const result = await getTournamentMatchGroupsResult(tournamentId, roundNumber);
  return requireData(result, 'Could not load match pairings');
}

function requireMatchMutation<T>(result: TournamentServiceResult<T>, action: string): T {
  return requireData(result, `Failed to ${action}. Check database permissions or log in again.`);
}

export async function saveTournamentMatchGroup(
  group: TournamentMatchGroupInsert
): Promise<TournamentMatchGroup | null> {
  const token = getManagerAccessToken();
  const existing = await tournamentSupabaseRequest<TournamentMatchGroup[]>(
    'tournament_match_groups',
    {
      query: {
        tournament_id: `eq.${group.tournament_id}`,
        round_number: `eq.${group.round_number}`,
        group_number: `eq.${group.group_number ?? 1}`,
      },
      accessToken: token,
    }
  );

  if (existing.error) {
    console.log('[TournamentMatch] lookup existing group:', existing.error);
    return null;
  }

  if (existing.data?.[0]) {
    const result = await tournamentSupabaseRequest<TournamentMatchGroup[]>(
      'tournament_match_groups',
      {
        method: 'PATCH',
        query: { id: `eq.${existing.data[0].id}` },
        body: group as unknown as Record<string, unknown>,
        accessToken: token,
      }
    );
    if (result.error) return null;
    return result.data?.[0] ?? null;
  }

  const result = await tournamentSupabaseRequest<TournamentMatchGroup[]>('tournament_match_groups', {
    method: 'POST',
    body: group as unknown as Record<string, unknown>,
    accessToken: token,
  });
  if (result.error) return null;
  return result.data?.[0] ?? null;
}

export async function deleteTournamentMatchGroup(groupId: string): Promise<boolean> {
  const result = await tournamentSupabaseRequest<TournamentMatchGroup[]>('tournament_match_groups', {
    method: 'DELETE',
    query: { id: `eq.${groupId}` },
    accessToken: getManagerAccessToken(),
  });
  return result.error === null;
}

export async function getMatchHoleResultsForGroups(
  matchGroupIds: string[],
  roundNumber: number
): Promise<TournamentMatchHoleResult[]> {
  if (matchGroupIds.length === 0) return [];

  const result = await tournamentSupabaseRequest<TournamentMatchHoleResult[]>(
    'tournament_match_hole_results',
    {
      query: {
        match_group_id: `in.(${matchGroupIds.join(',')})`,
        round_number: `eq.${roundNumber}`,
        order: 'match_group_id.asc,hole.asc',
      },
    }
  );
  return unwrapList(result);
}

export async function getMatchHoleResults(
  matchGroupId: string,
  roundNumber: number
): Promise<TournamentMatchHoleResult[]> {
  const result = await tournamentSupabaseRequest<TournamentMatchHoleResult[]>(
    'tournament_match_hole_results',
    {
      query: {
        match_group_id: `eq.${matchGroupId}`,
        round_number: `eq.${roundNumber}`,
        order: 'hole.asc',
      },
    }
  );
  return unwrapList(result);
}

export async function getMatchHoleResultsForTournament(
  tournamentId: string
): Promise<TournamentMatchHoleResult[]> {
  const groups = await getTournamentMatchGroups(tournamentId);
  if (groups.length === 0) return [];

  const groupIds = groups.map((g) => g.id).join(',');
  const result = await tournamentSupabaseRequest<TournamentMatchHoleResult[]>(
    'tournament_match_hole_results',
    {
      query: {
        match_group_id: `in.(${groupIds})`,
        order: 'round_number.asc,hole.asc',
      },
    }
  );
  return unwrapList(result);
}

export async function syncMatchHoleResults(params: {
  matchGroup: TournamentMatchGroup;
  roundNumber: number;
  format: TournamentFormat;
  scores: TournamentScore[];
  useNetScoring?: boolean;
  accessToken?: string | null;
}): Promise<TournamentMatchHoleResult[]> {
  const rows = computeMatchHoleResults(
    params.matchGroup,
    params.roundNumber,
    params.format,
    params.scores,
    { useNetScoring: params.useNetScoring ?? false }
  );

  const token =
    params.accessToken ??
    getManagerAccessToken() ??
    useMemberAuthStore.getState().accessToken;

  requireMatchMutation(
    await tournamentSupabaseRequest<TournamentMatchHoleResult[]>('tournament_match_hole_results', {
      method: 'DELETE',
      query: {
        match_group_id: `eq.${params.matchGroup.id}`,
        round_number: `eq.${params.roundNumber}`,
      },
      accessToken: token,
    }),
    'clear prior match hole results'
  );

  if (rows.length === 0) return [];

  const saved = requireMatchMutation(
    await tournamentSupabaseRequest<TournamentMatchHoleResult[]>('tournament_match_hole_results', {
      method: 'POST',
      body: rows as unknown as Record<string, unknown>[],
      accessToken: token,
    }),
    'save match hole results'
  );

  const holeResults = saved ?? [];
  await computeAndSaveMatchResults({
    matchGroup: params.matchGroup,
    format: params.format,
    scores: params.scores,
    holeResults,
    useNetScoring: params.useNetScoring ?? false,
    accessToken: token,
  });

  return holeResults;
}

export async function computeAndSaveMatchResults(params: {
  matchGroup: TournamentMatchGroup;
  format: TournamentFormat;
  scores: TournamentScore[];
  holeResults: TournamentMatchHoleResult[];
  useNetScoring?: boolean;
  accessToken?: string | null;
}): Promise<TournamentMatchGroup | null> {
  const points = computeMatchPoints(params);
  const token =
    params.accessToken ??
    getManagerAccessToken() ??
    useMemberAuthStore.getState().accessToken;

  const result = requireMatchMutation(
    await tournamentSupabaseRequest<TournamentMatchGroup[]>('tournament_match_groups', {
      method: 'PATCH',
      query: { id: `eq.${params.matchGroup.id}` },
      body: {
        match_winner: points.match_winner,
        match_points_a: points.match_points_a,
        match_points_b: points.match_points_b,
      },
      accessToken: token,
    }),
    'update match points'
  );

  return result?.[0] ?? null;
}

export async function clearTournamentMatchRound(params: {
  matchGroupId: string;
  roundNumber: number;
}): Promise<{ success: boolean; error?: string }> {
  const scoreResult = await deleteTournamentScoresForMatchRound(
    params.matchGroupId,
    params.roundNumber
  );
  if (!scoreResult.success) return scoreResult;

  const token =
    getManagerAccessToken() ?? useMemberAuthStore.getState().accessToken;

  try {
    requireMatchMutation(
      await tournamentSupabaseRequest<TournamentMatchHoleResult[]>('tournament_match_hole_results', {
        method: 'DELETE',
        query: {
          match_group_id: `eq.${params.matchGroupId}`,
          round_number: `eq.${params.roundNumber}`,
        },
        accessToken: token,
      }),
      'clear match hole results'
    );

    requireMatchMutation(
      await tournamentSupabaseRequest<TournamentMatchGroup[]>('tournament_match_groups', {
        method: 'PATCH',
        query: { id: `eq.${params.matchGroupId}` },
        body: {
          match_winner: null,
          match_points_a: 0,
          match_points_b: 0,
        },
        accessToken: token,
      }),
      'reset match results'
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to clear match data';
    return { success: false, error: message };
  }

  return { success: true };
}

export function getAssignedPlayerIdsForRound(
  groups: TournamentMatchGroup[],
  roundNumber: number,
  excludeGroupId?: string
): Set<string> {
  const assigned = new Set<string>();
  for (const group of groups) {
    if (group.round_number !== roundNumber) continue;
    if (excludeGroupId && group.id === excludeGroupId) continue;
    group.side_a_player_ids.forEach((id) => assigned.add(id));
    group.side_b_player_ids.forEach((id) => assigned.add(id));
  }
  return assigned;
}

export function resolveHoleWinner(
  sideANet: number,
  sideBNet: number
): TournamentMatchHoleWinner {
  if (sideANet < sideBNet) return 'side_a';
  if (sideBNet < sideANet) return 'side_b';
  return 'tie';
}

export function countMatchHoleWins(results: TournamentMatchHoleResult[]): {
  side_a: number;
  side_b: number;
  ties: number;
} {
  return results.reduce(
    (acc, row) => {
      if (row.hole_winner === 'side_a') acc.side_a += 1;
      else if (row.hole_winner === 'side_b') acc.side_b += 1;
      else acc.ties += 1;
      return acc;
    },
    { side_a: 0, side_b: 0, ties: 0 }
  );
}

export function getTeamBySide<T extends { side: string | null }>(
  teams: T[],
  side: 'side_a' | 'side_b'
): T | undefined {
  return teams.find((team) => team.side === side);
}
