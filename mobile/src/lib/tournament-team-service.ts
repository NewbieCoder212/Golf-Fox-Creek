import type { TournamentPlayer, TournamentTeam } from '@/types';
import { getBackendUrl } from './backend-url';

const BACKEND_REQUEST_TIMEOUT_MS = 4_000;

async function fetchBackend(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${getBackendUrl()}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
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
  try {
    const response = await fetchBackend(
      `/api/tournaments/${params.tournamentId}/send-participant-invites`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
        },
      }
    );

    const data = (await response.json()) as SendParticipantInvitesResult & { error?: string };

    if (!response.ok) {
      return { success: false, error: data.error ?? 'Could not send invites' };
    }

    return {
      success: true,
      emailed: data.emailed,
      invitesSent: data.invitesSent,
      skippedNoEmail: data.skippedNoEmail,
      skippedAlreadySent: data.skippedAlreadySent,
      errors: data.errors,
    };
  } catch {
    return { success: false, error: 'Could not reach tournament service' };
  }
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
