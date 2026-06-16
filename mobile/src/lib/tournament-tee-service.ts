/**
 * Tournament tee assignment service — manual tee times per team/player.
 */

import type { TournamentTeeAssignment, TournamentTeeAssignmentInsert } from '@/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);

async function supabaseRequest<T>(
  table: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    query?: Record<string, string>;
    body?: Record<string, unknown>;
    single?: boolean;
  } = {}
): Promise<T | null> {
  if (!isConfigured()) return null;

  const { method = 'GET', query = {}, body, single = false } = options;

  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  if (single) {
    headers['Accept'] = 'application/vnd.pgrst.object+json';
  }

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[TournamentTee] Error ${response.status}:`, errorText);
      return null;
    }

    return response.json();
  } catch (err) {
    console.log('[TournamentTee] Request failed:', err);
    return null;
  }
}

export async function getTournamentTeeAssignments(
  tournamentId: string,
  roundNumber?: number
): Promise<TournamentTeeAssignment[]> {
  if (!isConfigured()) return [];

  const query: Record<string, string> = {
    tournament_id: `eq.${tournamentId}`,
    order: 'round_number.asc,tee_time.asc',
  };

  if (roundNumber !== undefined) {
    query.round_number = `eq.${roundNumber}`;
  }

  const data = await supabaseRequest<TournamentTeeAssignment[]>('tournament_tee_assignments', {
    query,
  });

  return data ?? [];
}

async function getTeamTeeAssignment(
  tournamentId: string,
  teamId: string,
  roundNumber: number
): Promise<TournamentTeeAssignment | null> {
  return supabaseRequest<TournamentTeeAssignment>('tournament_tee_assignments', {
    query: {
      tournament_id: `eq.${tournamentId}`,
      team_id: `eq.${teamId}`,
      round_number: `eq.${roundNumber}`,
    },
    single: true,
  });
}

async function getUserTeeAssignment(
  tournamentId: string,
  userId: string,
  roundNumber: number
): Promise<TournamentTeeAssignment | null> {
  return supabaseRequest<TournamentTeeAssignment>('tournament_tee_assignments', {
    query: {
      tournament_id: `eq.${tournamentId}`,
      user_id: `eq.${userId}`,
      round_number: `eq.${roundNumber}`,
    },
    single: true,
  });
}

export async function saveTournamentTeeAssignment(
  assignment: TournamentTeeAssignmentInsert
): Promise<TournamentTeeAssignment | null> {
  if (!isConfigured()) return null;

  const existing = assignment.team_id
    ? await getTeamTeeAssignment(
        assignment.tournament_id,
        assignment.team_id,
        assignment.round_number
      )
    : assignment.user_id
      ? await getUserTeeAssignment(
          assignment.tournament_id,
          assignment.user_id,
          assignment.round_number
        )
      : null;

  const payload = {
    tee_time: assignment.tee_time,
    starting_hole: assignment.starting_hole ?? 1,
    notes: assignment.notes ?? null,
  };

  if (existing) {
    const result = await supabaseRequest<TournamentTeeAssignment[]>(
      'tournament_tee_assignments',
      {
        method: 'PATCH',
        query: { id: `eq.${existing.id}` },
        body: payload,
      }
    );
    return result?.[0] ?? null;
  }

  const result = await supabaseRequest<TournamentTeeAssignment[]>(
    'tournament_tee_assignments',
    {
      method: 'POST',
      body: assignment as unknown as Record<string, unknown>,
    }
  );

  return result?.[0] ?? null;
}

export async function deleteTournamentTeeAssignment(assignmentId: string): Promise<boolean> {
  if (!isConfigured()) return false;

  const result = await supabaseRequest<TournamentTeeAssignment[]>(
    'tournament_tee_assignments',
    {
      method: 'DELETE',
      query: { id: `eq.${assignmentId}` },
    }
  );

  return result !== null;
}

import { formatClubTime } from './club-timezone';

export function formatTeeAssignmentTime(isoTime: string): string {
  return formatClubTime(isoTime, true);
}
