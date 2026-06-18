import { Hono } from 'hono';
import { isSupabaseAdminConfigured } from '../lib/supabase-admin';
import {
  clearTournamentMatchScores,
  syncTournamentMatchScores,
} from '../lib/tournament-score-sync';
import { requireMemberAuth, type AuthUser } from '../middleware/auth';

type TournamentScoresEnv = {
  Variables: {
    authUser: AuthUser;
  };
};

const tournamentScoresRouter = new Hono<TournamentScoresEnv>();

tournamentScoresRouter.post('/:tournamentId/match-groups/:matchGroupId/sync', requireMemberAuth, async (c) => {
  if (!isSupabaseAdminConfigured()) {
    return c.json({ error: 'Tournament sync is not configured' }, 503);
  }

  const authUser = c.get('authUser');
  const matchGroupId = c.req.param('matchGroupId');
  const body = (await c.req.json()) as {
    roundNumber?: number;
    scores?: unknown[];
    holeResults?: unknown[];
    matchPoints?: {
      match_winner: 'side_a' | 'side_b' | 'tie' | null;
      match_points_a: number;
      match_points_b: number;
    };
  };

  if (!body.roundNumber || !Array.isArray(body.scores)) {
    return c.json({ error: 'roundNumber and scores array are required' }, 400);
  }

  const result = await syncTournamentMatchScores({
    userId: authUser.id,
    role: authUser.role,
    matchGroupId,
    roundNumber: body.roundNumber,
    scores: body.scores as Parameters<typeof syncTournamentMatchScores>[0]['scores'],
    holeResults: (body.holeResults ?? []) as Parameters<
      typeof syncTournamentMatchScores
    >[0]['holeResults'],
    matchPoints: body.matchPoints,
  });

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ success: true });
});

tournamentScoresRouter.post(
  '/:tournamentId/match-groups/:matchGroupId/clear',
  requireMemberAuth,
  async (c) => {
    if (!isSupabaseAdminConfigured()) {
      return c.json({ error: 'Tournament sync is not configured' }, 503);
    }

    const authUser = c.get('authUser');
    const matchGroupId = c.req.param('matchGroupId');
    const body = (await c.req.json()) as { roundNumber?: number };

    if (!body.roundNumber) {
      return c.json({ error: 'roundNumber is required' }, 400);
    }

    const result = await clearTournamentMatchScores({
      userId: authUser.id,
      role: authUser.role,
      matchGroupId,
      roundNumber: body.roundNumber,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true });
  }
);

export { tournamentScoresRouter };
