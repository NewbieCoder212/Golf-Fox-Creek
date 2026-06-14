/**
 * Wagering Service - Skins and Stableford side game sessions
 */

import type {
  SkinsSettings,
  StablefordSettings,
  WageringGameType,
  WageringSession,
  WageringSessionInsert,
  WageringSettings,
  WageringResults,
} from '@/types';
import {
  calculateSkinsResults,
  calculateStablefordResults,
  type PlayerNetScores,
} from './wagering-engine';

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
      console.log(`[Wagering] Error ${response.status}:`, errorText);
      return null;
    }

    return response.json();
  } catch (err) {
    console.log('[Wagering] Request failed:', err);
    return null;
  }
}

// ============================================
// WAGERING SESSIONS
// ============================================

export async function getWageringSessionById(sessionId: string): Promise<WageringSession | null> {
  if (!isConfigured()) return null;

  return supabaseRequest<WageringSession>('wagering_sessions', {
    query: { id: `eq.${sessionId}` },
    single: true,
  });
}

export async function getWageringSessionsForRound(roundId: string): Promise<WageringSession[]> {
  if (!isConfigured()) return [];

  const data = await supabaseRequest<WageringSession[]>('wagering_sessions', {
    query: {
      round_id: `eq.${roundId}`,
      order: 'created_at.desc',
    },
  });

  return data ?? [];
}

export async function getWageringSessionsForTournament(
  tournamentId: string
): Promise<WageringSession[]> {
  if (!isConfigured()) return [];

  const data = await supabaseRequest<WageringSession[]>('wagering_sessions', {
    query: {
      tournament_id: `eq.${tournamentId}`,
      order: 'created_at.desc',
    },
  });

  return data ?? [];
}

export async function getWageringSessionsByType(
  gameType: WageringGameType,
  limit = 20
): Promise<WageringSession[]> {
  if (!isConfigured()) return [];

  const data = await supabaseRequest<WageringSession[]>('wagering_sessions', {
    query: {
      game_type: `eq.${gameType}`,
      order: 'created_at.desc',
      limit: String(limit),
    },
  });

  return data ?? [];
}

export async function createWageringSession(
  session: WageringSessionInsert
): Promise<WageringSession | null> {
  if (!isConfigured()) return null;

  const result = await supabaseRequest<WageringSession[]>('wagering_sessions', {
    method: 'POST',
    body: {
      game_type: session.game_type,
      round_id: session.round_id ?? null,
      tournament_id: session.tournament_id ?? null,
      settings: session.settings ?? {},
      results: session.results ?? {},
    },
  });

  return result?.[0] ?? null;
}

export async function updateWageringSession(
  sessionId: string,
  updates: {
    settings?: WageringSettings;
    results?: WageringResults;
  }
): Promise<WageringSession | null> {
  if (!isConfigured()) return null;

  const result = await supabaseRequest<WageringSession[]>('wagering_sessions', {
    method: 'PATCH',
    query: { id: `eq.${sessionId}` },
    body: updates as unknown as Record<string, unknown>,
  });

  return result?.[0] ?? null;
}

export async function deleteWageringSession(sessionId: string): Promise<boolean> {
  if (!isConfigured()) return false;

  const result = await supabaseRequest<WageringSession[]>('wagering_sessions', {
    method: 'DELETE',
    query: { id: `eq.${sessionId}` },
  });

  return result !== null;
}

/**
 * Recalculate and persist live results for a wagering session.
 */
export async function refreshWageringResults(
  sessionId: string,
  players: PlayerNetScores[]
): Promise<WageringSession | null> {
  const session = await getWageringSessionById(sessionId);
  if (!session) return null;

  let results: WageringResults;

  if (session.game_type === 'skins') {
    results = calculateSkinsResults(players, session.settings as SkinsSettings);
  } else {
    results = calculateStablefordResults(players, session.settings as StablefordSettings);
  }

  return updateWageringSession(sessionId, { results });
}

export function isWageringServiceConfigured(): boolean {
  return isConfigured();
}

export { calculateSkinsResults, calculateStablefordResults };
export type { PlayerNetScores };
