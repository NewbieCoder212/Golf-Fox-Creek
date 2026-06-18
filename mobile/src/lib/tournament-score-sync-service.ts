import type {
  TournamentFormat,
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentScore,
  TournamentScoreInsert,
} from '@/types';
import { getBackendUrl, isBackendReachableInBrowser } from './backend-url';
import { getMemberAccessToken } from './tournament-supabase';
import { useMemberAuthStore } from './member-auth-store';
import { clearTournamentMatchRound, syncMatchHoleResults } from './tournament-match-service';
import { allOutcomesToHoleResults } from './match-hole-outcomes';
import {
  computeMatchHoleResults,
  computeMatchPoints,
  computeMatchPointsFromHoleResults,
  matchPointsForDeclaredWinner,
} from './tournament-match-scoring';
import { saveTournamentScore } from './tournament-service';
import type {
  HoleOutcomesMap,
  PairingOutcomesMap,
} from './match-hole-outcomes';

type MatchScoreSyncParams = {
  tournamentId: string;
  matchGroupId: string;
  roundNumber: number;
  format: TournamentFormat;
  scores: TournamentScoreInsert[];
  useNetScoring?: boolean;
  matchGroup: TournamentMatchGroup;
  holeOutcomes?: HoleOutcomesMap;
  pairingOutcomes?: PairingOutcomesMap;
};

export function buildPseudoTournamentScores(
  payloads: TournamentScoreInsert[]
): TournamentScore[] {
  return payloads.map((payload, index) => ({
    ...payload,
    team_id: payload.team_id ?? null,
    user_id: payload.user_id ?? null,
    tournament_player_id: payload.tournament_player_id ?? null,
    match_group_id: payload.match_group_id ?? null,
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
  const holeResultRows: TournamentMatchHoleResult[] = holeResults.map((row, index) => ({
    id: `local-${index}`,
    ...row,
  }));
  const matchPoints = computeMatchPoints({
    matchGroup: params.matchGroup,
    format: params.format,
    scores: pseudoScores,
    holeResults: holeResultRows,
    useNetScoring: params.useNetScoring ?? false,
  });

  return {
    roundNumber: params.roundNumber,
    scores: params.scores,
    holeResults: holeResultRows,
    matchPoints,
  };
}

export function buildDirectResultSyncPayload(params: {
  matchGroup: TournamentMatchGroup;
  roundNumber: number;
  format: TournamentFormat;
  holeOutcomes?: HoleOutcomesMap;
  pairingOutcomes?: PairingOutcomesMap;
}) {
  const holeResults = allOutcomesToHoleResults({
    matchGroupId: params.matchGroup.id,
    roundNumber: params.roundNumber,
    holeOutcomes: params.holeOutcomes,
    pairingOutcomes: params.pairingOutcomes,
  });

  const matchPoints = computeMatchPointsFromHoleResults({
    matchGroup: params.matchGroup,
    format: params.format,
    holeResults,
  });

  return {
    roundNumber: params.roundNumber,
    scores: [] as TournamentScoreInsert[],
    holeResults,
    matchPoints,
  };
}

type DirectResultSyncParams = {
  tournamentId: string;
  matchGroupId: string;
  roundNumber: number;
  format: TournamentFormat;
  matchGroup: TournamentMatchGroup;
  holeOutcomes?: HoleOutcomesMap;
  pairingOutcomes?: PairingOutcomesMap;
};

async function syncTournamentMatchScoresViaSupabase(
  params: MatchScoreSyncParams
): Promise<{ success: boolean; error?: string }> {
  const memberToken = getMemberAccessToken();
  const writeAuth = memberToken ? { accessToken: memberToken } : {};

  const useDirectResult =
    params.holeOutcomes != null || params.pairingOutcomes != null;

  if (useDirectResult) {
    const payload = buildDirectResultSyncPayload({
      matchGroup: params.matchGroup,
      roundNumber: params.roundNumber,
      format: params.format,
      holeOutcomes: params.holeOutcomes,
      pairingOutcomes: params.pairingOutcomes,
    });

    try {
      const { syncMatchHoleResultsDirect } = await import('./tournament-match-service');
      await syncMatchHoleResultsDirect({
        matchGroupId: params.matchGroupId,
        roundNumber: params.roundNumber,
        holeResults: payload.holeResults,
        matchPoints: payload.matchPoints,
        accessToken: memberToken,
      });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync match results';
      return { success: false, error: message };
    }
  }

  for (const score of params.scores) {
    const result = await saveTournamentScore(
      {
        ...score,
        match_group_id: score.match_group_id ?? params.matchGroupId,
      },
      writeAuth
    );
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
      accessToken: memberToken,
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
): Promise<
  | { ok: true }
  | { ok: false; error: string; retryable: boolean; status: number }
> {
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
        status: response.status,
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Could not reach tournament service',
      retryable: true,
      status: 0,
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

  const useDirectResult =
    params.holeOutcomes != null || params.pairingOutcomes != null;

  const payload = useDirectResult
    ? buildDirectResultSyncPayload({
        matchGroup: params.matchGroup,
        roundNumber: params.roundNumber,
        format: params.format,
        holeOutcomes: params.holeOutcomes,
        pairingOutcomes: params.pairingOutcomes,
      })
    : buildMatchSyncPayload({
        matchGroup: params.matchGroup,
        roundNumber: params.roundNumber,
        format: params.format,
        scores: params.scores,
        useNetScoring: params.useNetScoring,
      });

  let backendError: string | undefined;

  if (isBackendReachableInBrowser()) {
    const backendResult = await postToBackend(
      `/api/tournaments/${params.tournamentId}/match-groups/${params.matchGroupId}/sync`,
      accessToken,
      payload as unknown as Record<string, unknown>
    );

    if (backendResult.ok) {
      return { success: true };
    }

    backendError = backendResult.error;
    if (backendResult.status === 401) {
      return { success: false, error: backendResult.error };
    }
  }

  const supabaseResult = await syncTournamentMatchScoresViaSupabase(params);
  if (supabaseResult.success) {
    return supabaseResult;
  }

  if (backendError && supabaseResult.error) {
    return {
      success: false,
      error: `${supabaseResult.error} (API: ${backendError})`,
    };
  }

  return {
    success: false,
    error: supabaseResult.error ?? backendError ?? 'Could not save scores. Try again in a moment.',
  };
}

export async function declareMatchWinnerOverride(params: {
  tournamentId: string;
  matchGroupId: string;
  roundNumber: number;
  winner: 'side_a' | 'side_b' | 'tie';
}): Promise<{ success: boolean; error?: string }> {
  const matchPoints = matchPointsForDeclaredWinner(params.winner);
  const payload = {
    roundNumber: params.roundNumber,
    scores: [] as TournamentScoreInsert[],
    holeResults: [] as Omit<TournamentMatchHoleResult, 'id'>[],
    matchPoints,
  };

  const accessToken = useMemberAuthStore.getState().accessToken;
  if (!accessToken) {
    return { success: false, error: 'Not signed in' };
  }

  let backendError: string | undefined;

  if (isBackendReachableInBrowser()) {
    const backendResult = await postToBackend(
      `/api/tournaments/${params.tournamentId}/match-groups/${params.matchGroupId}/sync`,
      accessToken,
      payload as unknown as Record<string, unknown>
    );

    if (backendResult.ok) {
      return { success: true };
    }

    backendError = backendResult.error;
    if (backendResult.status === 401) {
      return { success: false, error: backendResult.error };
    }
  }

  try {
    const { syncMatchHoleResultsDirect } = await import('./tournament-match-service');
    await syncMatchHoleResultsDirect({
      matchGroupId: params.matchGroupId,
      roundNumber: params.roundNumber,
      holeResults: [],
      matchPoints,
      accessToken,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to declare match result';
    if (backendError) {
      return { success: false, error: `${message} (API: ${backendError})` };
    }
    return { success: false, error: message };
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

  if (isBackendReachableInBrowser()) {
    const backendResult = await postToBackend(
      `/api/tournaments/${params.tournamentId}/match-groups/${params.matchGroupId}/clear`,
      accessToken,
      { roundNumber: params.roundNumber }
    );

    if (backendResult.ok) {
      return { success: true };
    }

    if (backendResult.status === 401) {
      return { success: false, error: backendResult.error };
    }
  }

  return clearTournamentMatchScoresViaSupabase({
    matchGroupId: params.matchGroupId,
    roundNumber: params.roundNumber,
  });
}
