const BACKEND_URL =
  process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? 'http://localhost:3000';

export interface MarkTeamRosterReadyResult {
  success: boolean;
  emailed?: number;
  invitesSent?: number;
  skippedGuests?: number;
  errors?: string[];
  error?: string;
}

export async function markTeamRosterReadyAndNotify(params: {
  tournamentId: string;
  teamId: string;
  accessToken: string;
}): Promise<MarkTeamRosterReadyResult> {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/tournaments/${params.tournamentId}/teams/${params.teamId}/mark-ready-and-notify`,
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
