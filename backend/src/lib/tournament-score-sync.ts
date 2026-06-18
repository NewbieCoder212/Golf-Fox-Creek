import { adminFetch, getErrorMessage } from './supabase-admin';
import { computeMatchPointsFromHoleResults } from './tournament-match-points';

type TournamentScoreInsert = {
  tournament_id: string;
  team_id?: string | null;
  user_id?: string | null;
  tournament_player_id?: string | null;
  match_group_id?: string | null;
  round_number: number;
  hole_scores: unknown[];
  total_gross: number;
  total_net: number;
};

type MatchHoleResultInsert = {
  match_group_id: string;
  round_number: number;
  hole: number;
  side_a_net?: number | null;
  side_b_net?: number | null;
  hole_winner: 'side_a' | 'side_b' | 'tie';
  pairing_index?: number;
};

type MatchGroupRow = {
  id: string;
  tournament_id: string;
  format: string;
  side_a_player_ids: string[];
  side_b_player_ids: string[];
};

type TournamentPlayerRow = {
  id: string;
};

type TournamentScoreRow = {
  id: string;
};

export async function assertUserCanWriteMatchGroup(
  userId: string,
  role: string,
  matchGroupId: string
): Promise<{ ok: true; matchGroup: MatchGroupRow } | { ok: false; error: string }> {
  if (role === 'manager' || role === 'super_admin') {
    const groupRes = await adminFetch<MatchGroupRow[]>(
      `/rest/v1/tournament_match_groups?id=eq.${matchGroupId}&select=id,tournament_id,format,side_a_player_ids,side_b_player_ids`
    );
    if (!groupRes.ok || !groupRes.data[0]) {
      return { ok: false, error: 'Match pairing not found' };
    }
    return { ok: true, matchGroup: groupRes.data[0] };
  }

  const groupRes = await adminFetch<MatchGroupRow[]>(
    `/rest/v1/tournament_match_groups?id=eq.${matchGroupId}&select=id,tournament_id,format,side_a_player_ids,side_b_player_ids`
  );
  if (!groupRes.ok || !groupRes.data[0]) {
    return { ok: false, error: 'Match pairing not found' };
  }

  const matchGroup = groupRes.data[0];
  const playerRes = await adminFetch<TournamentPlayerRow[]>(
    `/rest/v1/tournament_players?tournament_id=eq.${matchGroup.tournament_id}&user_id=eq.${userId}&select=id`
  );
  const playerId = playerRes.data?.[0]?.id;
  if (!playerId) {
    return { ok: false, error: 'You are not on this tournament roster' };
  }

  const inGroup =
    matchGroup.side_a_player_ids.includes(playerId) ||
    matchGroup.side_b_player_ids.includes(playerId);
  if (!inGroup) {
    return { ok: false, error: 'You are not in this match pairing' };
  }

  return { ok: true, matchGroup };
}

async function findExistingScore(score: TournamentScoreInsert): Promise<TournamentScoreRow | null> {
  if (score.team_id) {
    const res = await adminFetch<TournamentScoreRow[]>(
      `/rest/v1/tournament_scores?tournament_id=eq.${score.tournament_id}&team_id=eq.${score.team_id}&round_number=eq.${score.round_number}&select=id`
    );
    return res.data?.[0] ?? null;
  }

  if (score.tournament_player_id) {
    const res = await adminFetch<TournamentScoreRow[]>(
      `/rest/v1/tournament_scores?tournament_id=eq.${score.tournament_id}&tournament_player_id=eq.${score.tournament_player_id}&round_number=eq.${score.round_number}&select=id`
    );
    return res.data?.[0] ?? null;
  }

  if (score.user_id) {
    const res = await adminFetch<TournamentScoreRow[]>(
      `/rest/v1/tournament_scores?tournament_id=eq.${score.tournament_id}&user_id=eq.${score.user_id}&round_number=eq.${score.round_number}&select=id`
    );
    return res.data?.[0] ?? null;
  }

  return null;
}

async function upsertTournamentScore(score: TournamentScoreInsert): Promise<string | null> {
  const existing = await findExistingScore(score);

  if (existing) {
    const res = await adminFetch<TournamentScoreRow[]>(
      `/rest/v1/tournament_scores?id=eq.${existing.id}`,
      {
        method: 'PATCH',
        body: {
          hole_scores: score.hole_scores,
          total_gross: score.total_gross,
          total_net: score.total_net,
          match_group_id: score.match_group_id ?? null,
        },
        prefer: 'return=representation',
      }
    );
    if (!res.ok) {
      throw new Error(getErrorMessage(res.data as unknown as Record<string, unknown>));
    }
    return res.data?.[0]?.id ?? existing.id;
  }

  const res = await adminFetch<TournamentScoreRow[]>(`/rest/v1/tournament_scores`, {
    method: 'POST',
    body: score,
    prefer: 'return=representation',
  });
  if (!res.ok) {
    throw new Error(getErrorMessage(res.data as unknown as Record<string, unknown>));
  }
  return res.data?.[0]?.id ?? null;
}

export async function syncTournamentMatchScores(params: {
  userId: string;
  role: string;
  matchGroupId: string;
  roundNumber: number;
  scores: TournamentScoreInsert[];
  holeResults: MatchHoleResultInsert[];
  matchPoints?: {
    match_winner: 'side_a' | 'side_b' | 'tie' | null;
    match_points_a: number;
    match_points_b: number;
  };
}): Promise<{ success: true } | { success: false; error: string }> {
  const access = await assertUserCanWriteMatchGroup(
    params.userId,
    params.role,
    params.matchGroupId
  );
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const matchGroup = access.matchGroup;

  const recomputedPoints = computeMatchPointsFromHoleResults({
    format: matchGroup.format,
    matchGroup,
    holeResults: params.holeResults,
  });

  const matchPoints = params.matchPoints ?? recomputedPoints;

  try {
    if (params.scores.length > 0) {
      for (const score of params.scores) {
        await upsertTournamentScore({
          ...score,
          match_group_id: score.match_group_id ?? params.matchGroupId,
        });
      }
    }

    const clearRes = await adminFetch<unknown>(
      `/rest/v1/tournament_match_hole_results?match_group_id=eq.${params.matchGroupId}&round_number=eq.${params.roundNumber}`,
      { method: 'DELETE' }
    );
    if (!clearRes.ok) {
      throw new Error(getErrorMessage(clearRes.data as unknown as Record<string, unknown>));
    }

    if (params.holeResults.length > 0) {
      const insertRes = await adminFetch<unknown>(`/rest/v1/tournament_match_hole_results`, {
        method: 'POST',
        body: params.holeResults,
        prefer: 'return=representation',
      });
      if (!insertRes.ok) {
        throw new Error(getErrorMessage(insertRes.data as unknown as Record<string, unknown>));
      }
    }

    const patchRes = await adminFetch<unknown>(
      `/rest/v1/tournament_match_groups?id=eq.${params.matchGroupId}`,
      {
        method: 'PATCH',
        body: matchPoints,
        prefer: 'return=minimal',
      }
    );
    if (!patchRes.ok) {
      throw new Error(getErrorMessage(patchRes.data as unknown as Record<string, unknown>));
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save scores';
    return { success: false, error: message };
  }
}

export async function clearTournamentMatchScores(params: {
  userId: string;
  role: string;
  matchGroupId: string;
  roundNumber: number;
}): Promise<{ success: true } | { success: false; error: string }> {
  const access = await assertUserCanWriteMatchGroup(
    params.userId,
    params.role,
    params.matchGroupId
  );
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  try {
    const scoresRes = await adminFetch<unknown>(
      `/rest/v1/tournament_scores?match_group_id=eq.${params.matchGroupId}&round_number=eq.${params.roundNumber}`,
      { method: 'DELETE' }
    );
    if (!scoresRes.ok) {
      throw new Error(getErrorMessage(scoresRes.data as unknown as Record<string, unknown>));
    }

    const holesRes = await adminFetch<unknown>(
      `/rest/v1/tournament_match_hole_results?match_group_id=eq.${params.matchGroupId}&round_number=eq.${params.roundNumber}`,
      { method: 'DELETE' }
    );
    if (!holesRes.ok) {
      throw new Error(getErrorMessage(holesRes.data as unknown as Record<string, unknown>));
    }

    const patchRes = await adminFetch<unknown>(
      `/rest/v1/tournament_match_groups?id=eq.${params.matchGroupId}`,
      {
        method: 'PATCH',
        body: {
          match_winner: null,
          match_points_a: 0,
          match_points_b: 0,
        },
        prefer: 'return=minimal',
      }
    );
    if (!patchRes.ok) {
      throw new Error(getErrorMessage(patchRes.data as unknown as Record<string, unknown>));
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to clear scores';
    return { success: false, error: message };
  }
}
