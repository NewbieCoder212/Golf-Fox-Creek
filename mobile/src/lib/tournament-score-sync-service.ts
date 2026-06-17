import type {
  TournamentFormat,
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentScore,
  TournamentScoreInsert,
} from '@/types';
import { getBackendUrl, isBackendReachableInBrowser } from './backend-url';
import { useMemberAuthStore } from './member-auth-store';
import { clearTournamentMatchRound, syncMatchHoleResults } from './tournament-match-service';
import { computeMatchHoleResults, computeMatchPoints } from './tournament-match-scoring';
import { saveTournamentScore } from './tournament-service';

type MatchScoreSyncParams = {
  tournamentId: string;
  matchGroupId: string;
  roundNumber: number;
  format: TournamentFormat;
  scores: TournamentScoreInsert[];
  useNetScoring?: boolean;
  matchGroup: TournamentMatchGroup;
};

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

async function syncTournamentMatchScoresViaSupabase(
  params: MatchScoreSyncParams
): Promise<{ success: boolean; error?: string }> {
  for (const score of params.scores) {
    const result = await saveTournamentScore({
      ...score,
      match_group_id: score.match_group_id ?? params.matchGroupId,
    });
    if (result.error) {
      return { success: false, error: result.error };
    }
  }

  try {
    const pseudoScores = buildPseudoTournamentScores(params.scores);
    await syncMatchHoleResults({
      matchGroup: params.matchGroup,
      roundNumber: params.roundNumber,
      format: params.format,
      scores: pseudoScores,
      useNetScoring: params.useNetScoring,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to sync match results';
    return { success: false, error: message };
  }
}

async function clearTournamentMatchScoresViaSupabase(params: {
  matchGroupId: string;
  roundNumber: number;
}): Promise<{ success: boolean; error?: string }> {
  return clearTournamentMatchRound(params);
}

async function postToBackend(
  path: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string; retryable: boolean }> {
  try {
    const response = await fetch(`${getBackendUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      const retryable = response.status >= 500 || response.status === 0;
      return {
        ok: false,
        error: data.error ?? 'Could not save scores',
        retryable,
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Could not reach tournament service',
      retryable: true,
    };
  }
}

export async function syncTournamentMatchScoresViaBackend(
  params: MatchScoreSyncParams
): Promise<{ success: boolean; error?: string }> {
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

  if (isBackendReachableInBrowser()) {
    const backendResult = await postToBackend(
      `/api/tournaments/${params.tournamentId}/match-groups/${params.matchGroupId}/sync`,
      accessToken,
      payload as unknown as Record<string, unknown>
    );

    if (backendResult.ok) {
      return { success: true };
    }

    if (!backendResult.retryable) {
      return { success: false, error: backendResult.error };
    }
  }

  const supabaseResult = await syncTournamentMatchScoresViaSupabase(params);
  if (supabaseResult.success) {
    return supabaseResult;
  }

  if (!isBackendReachableInBrowser()) {
    return supabaseResult;
  }

  return {
    success: false,
    error: supabaseResult.error ?? 'Could not save scores. Try again in a moment.',
  };
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

  if (isBackendReachableInBrowser()) {
    const backendResult = await postToBackend(
      `/api/tournaments/${params.tournamentId}/match-groups/${params.matchGroupId}/clear`,
      accessToken,
      { roundNumber: params.roundNumber }
    );

    if (backendResult.ok) {
      return { success: true };
    }

    if (!backendResult.retryable) {
      return { success: false, error: backendResult.error };
    }
  }

  return clearTournamentMatchScoresViaSupabase({
    matchGroupId: params.matchGroupId,
    roundNumber: params.roundNumber,
  });
}
