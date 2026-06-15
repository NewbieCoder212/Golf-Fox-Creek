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
import { computeMatchHoleResults, computeMatchPoints } from './tournament-match-scoring';
import { useAdminAuthStore } from './admin-auth-store';
import { useMemberAuthStore } from './member-auth-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);

function getAccessToken(): string {
  return (
    useMemberAuthStore.getState().accessToken ??
    useAdminAuthStore.getState().accessToken ??
    supabaseAnonKey
  );
}

async function supabaseRequest<T>(
  table: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    query?: Record<string, string>;
    body?: Record<string, unknown> | Record<string, unknown>[];
    single?: boolean;
  } = {}
): Promise<T | null> {
  if (!isConfigured()) return null;

  const { method = 'GET', query = {}, body, single = false } = options;
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.append(key, value));

  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${getAccessToken()}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  if (single) headers['Accept'] = 'application/vnd.pgrst.object+json';

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      console.log(`[TournamentMatch] Error ${response.status}:`, await response.text());
      return null;
    }

    return response.json();
  } catch (err) {
    console.log('[TournamentMatch] Request failed:', err);
    return null;
  }
}

export async function getTournamentMatchGroups(
  tournamentId: string,
  roundNumber?: number
): Promise<TournamentMatchGroup[]> {
  const query: Record<string, string> = {
    tournament_id: `eq.${tournamentId}`,
    order: 'round_number.asc,tee_time.asc,group_number.asc',
  };

  if (roundNumber !== undefined) {
    query.round_number = `eq.${roundNumber}`;
  }

  const data = await supabaseRequest<TournamentMatchGroup[]>('tournament_match_groups', { query });
  return data ?? [];
}

export async function saveTournamentMatchGroup(
  group: TournamentMatchGroupInsert
): Promise<TournamentMatchGroup | null> {
  const existing = await supabaseRequest<TournamentMatchGroup[]>('tournament_match_groups', {
    query: {
      tournament_id: `eq.${group.tournament_id}`,
      round_number: `eq.${group.round_number}`,
      group_number: `eq.${group.group_number ?? 1}`,
    },
  });

  if (existing?.[0]) {
    const result = await supabaseRequest<TournamentMatchGroup[]>('tournament_match_groups', {
      method: 'PATCH',
      query: { id: `eq.${existing[0].id}` },
      body: group as unknown as Record<string, unknown>,
    });
    return result?.[0] ?? null;
  }

  const result = await supabaseRequest<TournamentMatchGroup[]>('tournament_match_groups', {
    method: 'POST',
    body: group as unknown as Record<string, unknown>,
  });

  return result?.[0] ?? null;
}

export async function deleteTournamentMatchGroup(groupId: string): Promise<boolean> {
  const result = await supabaseRequest<TournamentMatchGroup[]>('tournament_match_groups', {
    method: 'DELETE',
    query: { id: `eq.${groupId}` },
  });
  return result !== null;
}

export async function getMatchHoleResultsForGroups(
  matchGroupIds: string[],
  roundNumber: number
): Promise<TournamentMatchHoleResult[]> {
  if (matchGroupIds.length === 0) return [];

  const data = await supabaseRequest<TournamentMatchHoleResult[]>('tournament_match_hole_results', {
    query: {
      match_group_id: `in.(${matchGroupIds.join(',')})`,
      round_number: `eq.${roundNumber}`,
      order: 'match_group_id.asc,hole.asc',
    },
  });
  return data ?? [];
}

export async function getMatchHoleResults(
  matchGroupId: string,
  roundNumber: number
): Promise<TournamentMatchHoleResult[]> {
  const data = await supabaseRequest<TournamentMatchHoleResult[]>('tournament_match_hole_results', {
    query: {
      match_group_id: `eq.${matchGroupId}`,
      round_number: `eq.${roundNumber}`,
      order: 'hole.asc',
    },
  });
  return data ?? [];
}

export async function getMatchHoleResultsForTournament(
  tournamentId: string
): Promise<TournamentMatchHoleResult[]> {
  const groups = await getTournamentMatchGroups(tournamentId);
  if (groups.length === 0) return [];

  const groupIds = groups.map((g) => g.id).join(',');
  const data = await supabaseRequest<TournamentMatchHoleResult[]>('tournament_match_hole_results', {
    query: {
      match_group_id: `in.(${groupIds})`,
      order: 'round_number.asc,hole.asc',
    },
  });
  return data ?? [];
}

export async function syncMatchHoleResults(params: {
  matchGroup: TournamentMatchGroup;
  roundNumber: number;
  format: TournamentFormat;
  scores: TournamentScore[];
}): Promise<TournamentMatchHoleResult[]> {
  const rows = computeMatchHoleResults(
    params.matchGroup,
    params.roundNumber,
    params.format,
    params.scores
  );

  await supabaseRequest<TournamentMatchHoleResult[]>('tournament_match_hole_results', {
    method: 'DELETE',
    query: {
      match_group_id: `eq.${params.matchGroup.id}`,
      round_number: `eq.${params.roundNumber}`,
    },
  });

  if (rows.length === 0) return [];

  const saved = await supabaseRequest<TournamentMatchHoleResult[]>('tournament_match_hole_results', {
    method: 'POST',
    body: rows as unknown as Record<string, unknown>[],
  });

  const holeResults = saved ?? [];
  await computeAndSaveMatchResults({
    matchGroup: params.matchGroup,
    format: params.format,
    scores: params.scores,
    holeResults,
  });

  return holeResults;
}

export async function computeAndSaveMatchResults(params: {
  matchGroup: TournamentMatchGroup;
  format: TournamentFormat;
  scores: TournamentScore[];
  holeResults: TournamentMatchHoleResult[];
}): Promise<TournamentMatchGroup | null> {
  const points = computeMatchPoints(params);

  const result = await supabaseRequest<TournamentMatchGroup[]>('tournament_match_groups', {
    method: 'PATCH',
    query: { id: `eq.${params.matchGroup.id}` },
    body: {
      match_winner: points.match_winner,
      match_points_a: points.match_points_a,
      match_points_b: points.match_points_b,
    },
  });

  return result?.[0] ?? null;
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
