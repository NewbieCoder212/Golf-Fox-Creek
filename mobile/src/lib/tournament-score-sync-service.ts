import type {
  TournamentFormat,
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentScore,
  TournamentScoreInsert,
} from '@/types';
import { useMemberAuthStore } from './member-auth-store';
import { computeMatchHoleResults, computeMatchPoints } from './tournament-match-scoring';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? 'http://localhost:3000';

export function buildPseudoTournamentScores(
  payloads: TournamentScoreInsert[]
): TournamentScore[] {
  return payloads.map((payload, index) => ({
    ...payload,
    id: `local-${index}`,
    created_at: new Date().toISOString(),
  }));
}

export function buildMatchSyncPayload(params: {
  matchGroup: TournamentMatchGroup;
  roundNumber: number;
  format: TournamentFormat;
  scores: TournamentScoreInsert[];
  useNetScoring?: boolean;
}) {
  const pseudoScores = buildPseudoTournamentScores(params.scores);
  const holeResults = computeMatchHoleResults(
    params.matchGroup,
    params.roundNumber,
    params.format,
    pseudoScores,
    { useNetScoring: params.useNetScoring ?? false }
  );
  const matchPoints = computeMatchPoints({
    matchGroup: params.matchGroup,
    format: params.format,
    scores: pseudoScores,
    holeResults,
    useNetScoring: params.useNetScoring ?? false,
  });

  const holeResultRows: Omit<TournamentMatchHoleResult, 'id'>[] = holeResults.map((row) => ({
    match_group_id: params.matchGroup.id,
    round_number: params.roundNumber,
    hole: row.hole,
    side_a_net: row.side_a_net,
    side_b_net: row.side_b_net,
    hole_winner: row.hole_winner,
  }));

  return {
    roundNumber: params.roundNumber,
    scores: params.scores,
    holeResults: holeResultRows,
    matchPoints,
  };
}

export async function syncTournamentMatchScoresViaBackend(params: {
  tournamentId: string;
  matchGroupId: string;
  roundNumber: number;
  format: TournamentFormat;
  scores: TournamentScoreInsert[];
  useNetScoring?: boolean;
  matchGroup: TournamentMatchGroup;
}): Promise<{ success: boolean; error?: string }> {
  const accessToken = useMemberAuthStore.getState().accessToken;
  if (!accessToken) {
    return { success: false, error: 'Not signed in' };
  }

  const payload = buildMatchSyncPayload({
    matchGroup: params.matchGroup,
    roundNumber: params.roundNumber,
    format: params.format,
    scores: params.scores,
    useNetScoring: params.useNetScoring,
  });

  try {
    const response = await fetch(
      `${BACKEND_URL}/api/tournaments/${params.tournamentId}/match-groups/${params.matchGroupId}/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok) {
      return { success: false, error: data.error ?? 'Could not save scores' };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Could not reach tournament service. Is the backend running?' };
  }
}

export async function clearTournamentMatchScoresViaBackend(params: {
  tournamentId: string;
  matchGroupId: string;
  roundNumber: number;
}): Promise<{ success: boolean; error?: string }> {
  const accessToken = useMemberAuthStore.getState().accessToken;
  if (!accessToken) {
    return { success: false, error: 'Not signed in' };
  }

  try {
    const response = await fetch(
      `${BACKEND_URL}/api/tournaments/${params.tournamentId}/match-groups/${params.matchGroupId}/clear`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ roundNumber: params.roundNumber }),
      }
    );

    const data = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok) {
      return { success: false, error: data.error ?? 'Could not clear scores' };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Could not reach tournament service. Is the backend running?' };
  }
}
