import type { TournamentPlayer, TournamentTeam } from '@/types';
import { ensureManagerAccessToken } from './admin-auth-bridge';
import { getBackendUrl, isBackendReachableInBrowser, isLocalhostBackendUrl } from './backend-url';

const BACKEND_REQUEST_TIMEOUT_MS = 4_000;
const BACKEND_INVITE_TIMEOUT_MS = 60_000;

function backendReachabilityError(): string {
  if (typeof window !== 'undefined' && isLocalhostBackendUrl()) {
    return 'Tournament service is not reachable. Start the backend on port 3000 or set EXPO_PUBLIC_VIBECODE_BACKEND_URL to your deployed API URL in mobile/.env, then restart Expo.';
  }
  return 'Could not reach tournament service. Check your connection and try again.';
}

function fetchFailureMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return 'Tournament service timed out. Try again in a moment.';
    }
    if (error.message === 'Load failed') {
      return 'Could not reach tournament service. Check your connection and try again.';
    }
    if (error.message) {
      return error.message;
    }
  }
  return backendReachabilityError();
}

async function fetchBackend(
  path: string,
  init: RequestInit = {},
  timeoutMs = BACKEND_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${getBackendUrl()}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readBackendJson<T>(response: Response): Promise<T & { error?: string }> {
  const text = await response.text();
  if (!text.trim()) {
    return {} as T & { error?: string };
  }
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    return { error: response.ok ? undefined : `Unexpected response (${response.status})` } as T & {
      error?: string;
    };
  }
}

async function postBackendWithManagerAuth<T extends { error?: string }>(
  path: string,
  accessToken: string,
  options: {
    body?: Record<string, unknown>;
    timeoutMs?: number;
    retried?: boolean;
  } = {}
): Promise<{ response: Response; data: T; accessToken: string } | { error: string }> {
  if (!isBackendReachableInBrowser()) {
    return { error: backendReachabilityError() };
  }

  const token = (await ensureManagerAccessToken(accessToken)) ?? accessToken;
  if (!token) {
    return { error: 'Session expired. Log out and log back in, then try again.' };
  }

  try {
    const response = await fetchBackend(
      path,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      },
      options.timeoutMs ?? BACKEND_REQUEST_TIMEOUT_MS
    );

    const data = await readBackendJson<T>(response);

    if (response.status === 401 && !options.retried) {
      const refreshed = await ensureManagerAccessToken(null);
      if (refreshed && refreshed !== token) {
        return postBackendWithManagerAuth(path, refreshed, { ...options, retried: true });
      }
    }

    if (!response.ok) {
      const message =
        data.error ??
        (typeof (data as { message?: string }).message === 'string'
          ? (data as { message?: string }).message
          : undefined);
      return { error: message ?? `Request failed (${response.status})` };
    }

    return { response, data, accessToken: token };
  } catch (error) {
    return { error: fetchFailureMessage(error) };
  }
}

export interface MarkTeamRosterReadyResult {
  success: boolean;
  emailed?: number;
  invitesSent?: number;
  skippedGuests?: number;
  errors?: string[];
  error?: string;
}

export interface UpdateTournamentTeamResult {
  data: TournamentTeam | null;
  error: string | null;
}

export async function markTeamRosterReadyAndNotify(params: {
  tournamentId: string;
  teamId: string;
  accessToken: string;
}): Promise<MarkTeamRosterReadyResult> {
  try {
    const response = await fetchBackend(
      `/api/tournaments/${params.tournamentId}/teams/${params.teamId}/mark-ready-and-notify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
        },
      }
    );

    const data = (await response.json()) as MarkTeamRosterReadyResult & { error?: string };

    if (!response.ok) {
      return { success: false, error: data.error ?? 'Could not mark roster ready' };
    }

    return {
      success: true,
      emailed: data.emailed,
      invitesSent: data.invitesSent,
      skippedGuests: data.skippedGuests,
      errors: data.errors,
    };
  } catch {
    return { success: false, error: 'Could not reach tournament service' };
  }
}

export async function updateTournamentTeamViaBackend(params: {
  tournamentId: string;
  teamId: string;
  accessToken: string;
  updates: {
    team_name?: string;
    captain_user_id?: string | null;
    captain_player_id?: string | null;
    player_ids?: string[];
  };
}): Promise<UpdateTournamentTeamResult> {
  try {
    const response = await fetchBackend(
      `/api/tournaments/${params.tournamentId}/teams/${params.teamId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params.updates),
      }
    );

    const data = (await response.json()) as TournamentTeam & { error?: string };

    if (!response.ok) {
      return { data: null, error: data.error ?? 'Could not update team' };
    }

    if (!data.id) {
      return { data: null, error: 'Team was not updated' };
    }

    return { data, error: null };
  } catch {
    return { data: null, error: 'Could not reach tournament service' };
  }
}

export interface SendParticipantInvitesResult {
  success: boolean;
  emailed?: number;
  invitesSent?: number;
  skippedNoEmail?: number;
  skippedAlreadySent?: number;
  errors?: string[];
  error?: string;
}

export async function sendParticipantInvites(params: {
  tournamentId: string;
  accessToken: string;
}): Promise<SendParticipantInvitesResult> {
  const result = await postBackendWithManagerAuth<SendParticipantInvitesResult>(
    `/api/tournaments/${params.tournamentId}/send-participant-invites`,
    params.accessToken,
    { timeoutMs: BACKEND_INVITE_TIMEOUT_MS }
  );

  if ('error' in result) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    emailed: result.data.emailed,
    invitesSent: result.data.invitesSent,
    skippedNoEmail: result.data.skippedNoEmail,
    skippedAlreadySent: result.data.skippedAlreadySent,
    errors: result.data.errors,
  };
}

export interface SendParticipantInviteResult {
  success: boolean;
  emailed?: number;
  invitesSent?: number;
  email?: string;
  skippedAlreadySent?: boolean;
  error?: string;
}

export async function sendParticipantInvite(params: {
  tournamentId: string;
  playerId: string;
  accessToken: string;
  resend?: boolean;
}): Promise<SendParticipantInviteResult> {
  const result = await postBackendWithManagerAuth<
    SendParticipantInviteResult & { skippedAlreadySent?: boolean }
  >(
    `/api/tournaments/${params.tournamentId}/participants/${params.playerId}/send-invite`,
    params.accessToken,
    {
      body: { resend: params.resend === true },
      timeoutMs: BACKEND_INVITE_TIMEOUT_MS,
    }
  );

  if ('error' in result) {
    const isTimeout = result.error.includes('timed out');
    return {
      success: false,
      error: isTimeout
        ? 'The request took too long, but the email may still have been sent. Refresh the list and check the inbox before trying again.'
        : result.error,
      skippedAlreadySent: result.error.includes('already sent'),
    };
  }

  return {
    success: true,
    emailed: result.data.emailed,
    invitesSent: result.data.invitesSent,
    email: result.data.email,
  };
}

export async function deleteTournamentParticipantViaBackend(params: {
  tournamentId: string;
  playerId: string;
  accessToken: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetchBackend(
      `/api/tournaments/${params.tournamentId}/participants/${params.playerId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
        },
      }
    );

    const data = (await response.json()) as { success?: boolean; error?: string };

    if (!response.ok) {
      return { success: false, error: data.error ?? 'Could not delete participant' };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Could not reach tournament service' };
  }
}

export async function updateTournamentParticipantViaBackend(params: {
  tournamentId: string;
  playerId: string;
  accessToken: string;
  updates: {
    display_name?: string;
    email?: string | null;
    handicap_index?: number | null;
    user_id?: string | null;
  };
}): Promise<{ data: TournamentPlayer | null; error: string | null }> {
  try {
    const response = await fetchBackend(
      `/api/tournaments/${params.tournamentId}/participants/${params.playerId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params.updates),
      }
    );

    const data = (await response.json()) as TournamentPlayer & { error?: string };

    if (!response.ok) {
      return { data: null, error: data.error ?? 'Could not update participant' };
    }

    if (!data.id) {
      return { data: null, error: 'Participant was not updated' };
    }

    return { data, error: null };
  } catch {
    return { data: null, error: 'Could not reach tournament service' };
  }
}
