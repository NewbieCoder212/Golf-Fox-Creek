/**
 * Shared Supabase REST client for tournament tables.
 * Uses member/admin JWT when available; does not silently fall back to anon on auth errors.
 */

import { useAdminAuthStore } from './admin-auth-store';
import { useMemberAuthStore } from './member-auth-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isTournamentSupabaseConfigured = () =>
  Boolean(supabaseUrl && supabaseAnonKey);

function getAccessToken(): string {
  return (
    useMemberAuthStore.getState().accessToken ??
    useAdminAuthStore.getState().accessToken ??
    supabaseAnonKey
  );
}

export function getManagerAccessToken(): string | null {
  const admin = useAdminAuthStore.getState();
  const member = useMemberAuthStore.getState();

  if (
    admin.accessToken &&
    (admin.profile?.role === 'manager' || admin.profile?.role === 'super_admin')
  ) {
    return admin.accessToken;
  }

  if (
    member.accessToken &&
    (member.profile?.role === 'manager' || member.profile?.role === 'super_admin')
  ) {
    return member.accessToken;
  }

  return admin.accessToken ?? member.accessToken ?? null;
}

/** Member JWT for participant scorecard actions (never prefer a stale admin session). */
export function getMemberAccessToken(): string | null {
  return useMemberAuthStore.getState().accessToken;
}

function resolveTournamentAccessToken(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  accessToken?: string | null
): string {
  if (accessToken) return accessToken;
  // Reads must use the signed-in member JWT when available — not a stale admin session.
  if (method === 'GET') {
    return getAccessToken();
  }
  return getManagerAccessToken() ?? getAccessToken();
}

export interface TournamentServiceError {
  data: null;
  error: string;
}

export type TournamentServiceResult<T> = { data: T; error: null } | TournamentServiceError;

function parseSupabaseError(status: number, errorText: string): string {
  try {
    const parsed = JSON.parse(errorText) as { message?: string; code?: string };
    if (parsed.message?.includes('captain_player_id') && parsed.code === '42703') {
      return 'Missing captain_player_id column. Run supabase/migrations/20260716000000_tournament_team_captain_player.sql in the Supabase SQL editor.';
    }
    if (parsed.message?.includes('row-level security') || parsed.code === '42501') {
      if (parsed.message?.includes('tournament_scores')) {
        return 'Database permissions blocked score sync. Run supabase/migrations/20260707000000_tournament_scorecard_member_writes.sql in the Supabase SQL editor.';
      }
      return 'Database permissions blocked this request. Log in as a manager or participant, or run supabase/migrations/20260628000000_tournament_tv_display.sql for public TV reads.';
    }
    if (parsed.message?.includes('tournament_players') && parsed.code === '42P01') {
      return 'Missing tournament_players table. Run supabase/migrations/20260621000000_tournament_players.sql in Supabase.';
    }
    if (parsed.message?.includes('side') && parsed.code === '42703') {
      return 'Missing team side column. Run supabase/migrations/20260620000000_tournament_match_groups.sql in Supabase.';
    }
    if (parsed.code === 'PGRST301' || parsed.message?.includes('JWT')) {
      return 'Session expired. Log out and log back in, then try again.';
    }
    return parsed.message ?? `Request failed (${status})`;
  } catch {
    return errorText || `Request failed (${status})`;
  }
}

async function fetchWithToken(
  url: string,
  init: RequestInit,
  token: string
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('apikey', supabaseAnonKey);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export async function tournamentSupabaseRequest<T>(
  table: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    query?: Record<string, string>;
    body?: Record<string, unknown> | Record<string, unknown>[];
    single?: boolean;
    accessToken?: string | null;
  } = {}
): Promise<TournamentServiceResult<T>> {
  if (!isTournamentSupabaseConfigured()) {
    return { data: null, error: 'Supabase is not configured' };
  }

  const { method = 'GET', query = {}, body, single = false, accessToken } = options;
  const isMutation = method !== 'GET';
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.append(key, value));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  if (single) {
    headers['Accept'] = 'application/vnd.pgrst.object+json';
  }

  const init: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  try {
    const primaryToken = resolveTournamentAccessToken(method, accessToken);
    let response = await fetchWithToken(url.toString(), init, primaryToken);

    if (
      !response.ok &&
      response.status === 401 &&
      primaryToken !== supabaseAnonKey &&
      !accessToken
    ) {
      const memberToken = useMemberAuthStore.getState().accessToken;
      const adminToken = useAdminAuthStore.getState().accessToken;
      const retryToken =
        primaryToken === memberToken && adminToken && adminToken !== memberToken
          ? adminToken
          : primaryToken === adminToken && memberToken && memberToken !== adminToken
            ? memberToken
            : null;
      if (retryToken) {
        response = await fetchWithToken(url.toString(), init, retryToken);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Tournament] ${method} ${table} ${response.status}:`, errorText);
      if (response.status === 401 && primaryToken !== supabaseAnonKey) {
        return {
          data: null,
          error: 'Session expired. Log out and log back in, then try again.',
        };
      }
      if (response.status === 401 && isMutation) {
        return {
          data: null,
          error: 'Session expired. Log out and log back in, then try again.',
        };
      }
      return { data: null, error: parseSupabaseError(response.status, errorText) };
    }

    const responseText = await response.text();
    const data = (responseText ? JSON.parse(responseText) : null) as T;
    return { data, error: null };
  } catch (err) {
    console.log(`[Tournament] ${method} ${table} network error:`, err);
    return { data: null, error: 'Network error contacting Supabase' };
  }
}

export function unwrapList<T>(result: TournamentServiceResult<T[]>): T[] {
  if (result.error) return [];
  return result.data ?? [];
}

export function unwrapSingle<T>(result: TournamentServiceResult<T>): T | null {
  if (result.error) return null;
  return result.data;
}

export function unwrapOk(result: TournamentServiceResult<unknown>): boolean {
  return result.error === null;
}

export function requireData<T>(
  result: TournamentServiceResult<T>,
  fallbackMessage: string
): T {
  if (result.error) {
    throw new Error(result.error);
  }
  if (result.data === null || result.data === undefined) {
    throw new Error(fallbackMessage);
  }
  return result.data;
}
