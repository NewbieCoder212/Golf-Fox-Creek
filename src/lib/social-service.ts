/**
 * Social Service - Leaderboard, Find a Partner, Challenges
 */

import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardScoreType,
  LookingForGame,
  LookingForGameInsert,
  Challenge,
  ChallengeInsert,
  UserProfile,
} from '@/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Generic Supabase request helper
 */
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

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

// ============================================
// LEADERBOARD
// ============================================

/**
 * Get date range for leaderboard period
 */
function getDateRange(period: LeaderboardPeriod): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();

  let start: Date;

  switch (period) {
    case 'weekly':
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      break;
    case 'monthly':
      start = new Date(now);
      start.setMonth(now.getMonth() - 1);
      break;
    case 'all_time':
    default:
      start = new Date('2020-01-01');
      break;
  }

  return { start: start.toISOString(), end };
}

/**
 * Get leaderboard entries for a given period and score type
 */
export async function getLeaderboard(
  period: LeaderboardPeriod = 'weekly',
  scoreType: LeaderboardScoreType = 'gross',
  limit = 20
): Promise<LeaderboardEntry[]> {
  if (!isConfigured()) {
    // Return mock data when not configured
    return getMockLeaderboard();
  }

  const { start } = getDateRange(period);

  // Use RPC function for complex aggregation, or fetch and compute client-side
  // For now, we'll fetch rounds and compute leaderboard client-side
  const roundsData = await supabaseRequest<
    Array<{
      user_id: string;
      gross_score: number;
      adjusted_score: number | null;
      differential: number | null;
      played_at: string;
    }>
  >('rounds', {
    query: {
      'played_at': `gte.${start}`,
      'select': 'user_id,gross_score,adjusted_score,differential,played_at',
      'order': 'played_at.desc',
    },
  });

  if (!roundsData || roundsData.length === 0) {
    return getMockLeaderboard();
  }

  // Get user profiles for names
  const userIds = [...new Set(roundsData.map((r) => r.user_id))];
  const profiles = await supabaseRequest<UserProfile[]>('user_profiles', {
    query: {
      'id': `in.(${userIds.join(',')})`,
      'select': 'id,full_name,handicap_index',
    },
  });

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  // Aggregate by user
  const userStats = new Map<
    string,
    {
      rounds: number;
      bestGross: number;
      bestNet: number;
      totalScore: number;
      totalDifferential: number;
    }
  >();

  for (const round of roundsData) {
    const existing = userStats.get(round.user_id) ?? {
      rounds: 0,
      bestGross: Infinity,
      bestNet: Infinity,
      totalScore: 0,
      totalDifferential: 0,
    };

    existing.rounds += 1;
    existing.bestGross = Math.min(existing.bestGross, round.gross_score);
    existing.bestNet = Math.min(
      existing.bestNet,
      round.adjusted_score ?? round.gross_score
    );
    existing.totalScore += round.gross_score;
    existing.totalDifferential += round.differential ?? 0;

    userStats.set(round.user_id, existing);
  }

  // Convert to leaderboard entries
  const entries: LeaderboardEntry[] = [];

  for (const [userId, stats] of userStats) {
    const profile = profileMap.get(userId);

    entries.push({
      user_id: userId,
      full_name: profile?.full_name ?? 'Unknown',
      handicap_index: profile?.handicap_index ?? null,
      rounds_played: stats.rounds,
      best_gross: stats.bestGross === Infinity ? null : stats.bestGross,
      best_net: stats.bestNet === Infinity ? null : stats.bestNet,
      average_score: stats.rounds > 0 ? Math.round(stats.totalScore / stats.rounds) : null,
      total_differential:
        stats.rounds > 0 ? Math.round((stats.totalDifferential / stats.rounds) * 10) / 10 : null,
    });
  }

  // Sort by score type
  entries.sort((a, b) => {
    if (scoreType === 'gross') {
      return (a.best_gross ?? 999) - (b.best_gross ?? 999);
    } else {
      return (a.best_net ?? 999) - (b.best_net ?? 999);
    }
  });

  return entries.slice(0, limit);
}

/**
 * Mock leaderboard data for demo/offline
 */
function getMockLeaderboard(): LeaderboardEntry[] {
  return [
    {
      user_id: '1',
      full_name: 'Mike Johnson',
      handicap_index: 8.2,
      rounds_played: 4,
      best_gross: 78,
      best_net: 70,
      average_score: 82,
      total_differential: 6.4,
    },
    {
      user_id: '2',
      full_name: 'Sarah Williams',
      handicap_index: 12.5,
      rounds_played: 3,
      best_gross: 85,
      best_net: 72,
      average_score: 88,
      total_differential: 10.2,
    },
    {
      user_id: '3',
      full_name: 'Tom Richards',
      handicap_index: 5.1,
      rounds_played: 5,
      best_gross: 74,
      best_net: 69,
      average_score: 77,
      total_differential: 3.8,
    },
    {
      user_id: '4',
      full_name: 'Lisa Chen',
      handicap_index: 18.3,
      rounds_played: 2,
      best_gross: 92,
      best_net: 74,
      average_score: 95,
      total_differential: 16.1,
    },
    {
      user_id: '5',
      full_name: 'James Brown',
      handicap_index: 10.7,
      rounds_played: 4,
      best_gross: 82,
      best_net: 71,
      average_score: 85,
      total_differential: 8.9,
    },
  ];
}

// ============================================
// FIND A PARTNER
// ============================================

/**
 * Get active "Looking for Game" posts
 */
export async function getLookingForGame(): Promise<LookingForGame[]> {
  if (!isConfigured()) {
    return getMockLookingForGame();
  }

  const now = new Date().toISOString();

  const data = await supabaseRequest<LookingForGame[]>('looking_for_game', {
    query: {
      'is_active': 'eq.true',
      'expires_at': `gte.${now}`,
      'order': 'preferred_date.asc',
    },
  });

  if (!data || data.length === 0) {
    return getMockLookingForGame();
  }

  return data;
}

/**
 * Create or update a "Looking for Game" post
 */
export async function postLookingForGame(
  data: LookingForGameInsert
): Promise<LookingForGame | null> {
  if (!isConfigured()) return null;

  // Set expiration to end of preferred date
  const expiresAt = new Date(data.preferred_date);
  expiresAt.setHours(23, 59, 59, 999);

  const result = await supabaseRequest<LookingForGame[]>('looking_for_game', {
    method: 'POST',
    body: {
      ...data,
      is_active: true,
      expires_at: data.expires_at ?? expiresAt.toISOString(),
    },
  });

  return result?.[0] ?? null;
}

/**
 * Cancel a "Looking for Game" post
 */
export async function cancelLookingForGame(postId: string): Promise<boolean> {
  if (!isConfigured()) return false;

  const result = await supabaseRequest('looking_for_game', {
    method: 'PATCH',
    query: { id: `eq.${postId}` },
    body: { is_active: false },
  });

  return result !== null;
}

/**
 * Get user's current "Looking for Game" post
 */
export async function getUserLookingForGame(userId: string): Promise<LookingForGame | null> {
  if (!isConfigured()) return null;

  const now = new Date().toISOString();

  return supabaseRequest<LookingForGame>('looking_for_game', {
    query: {
      'user_id': `eq.${userId}`,
      'is_active': 'eq.true',
      'expires_at': `gte.${now}`,
    },
    single: true,
  });
}

/**
 * Mock looking for game data
 */
function getMockLookingForGame(): LookingForGame[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);

  return [
    {
      id: '1',
      user_id: '1',
      full_name: 'Mike Johnson',
      handicap_index: 8.2,
      preferred_date: tomorrow.toISOString().split('T')[0],
      preferred_time: 'morning',
      notes: 'Looking for a quick 18, walking preferred',
      is_active: true,
      created_at: new Date().toISOString(),
      expires_at: tomorrow.toISOString(),
    },
    {
      id: '2',
      user_id: '2',
      full_name: 'Sarah Williams',
      handicap_index: 12.5,
      preferred_date: tomorrow.toISOString().split('T')[0],
      preferred_time: 'afternoon',
      notes: null,
      is_active: true,
      created_at: new Date().toISOString(),
      expires_at: tomorrow.toISOString(),
    },
    {
      id: '3',
      user_id: '3',
      full_name: 'Tom Richards',
      handicap_index: 5.1,
      preferred_date: dayAfter.toISOString().split('T')[0],
      preferred_time: 'any',
      notes: 'New member, happy to play with anyone!',
      is_active: true,
      created_at: new Date().toISOString(),
      expires_at: dayAfter.toISOString(),
    },
  ];
}

// ============================================
// CHALLENGES
// ============================================

/**
 * Get user's challenges (sent and received)
 */
export async function getUserChallenges(userId: string): Promise<Challenge[]> {
  if (!isConfigured()) {
    return getMockChallenges(userId);
  }

  const data = await supabaseRequest<Challenge[]>('challenges', {
    query: {
      'or': `(challenger_id.eq.${userId},challenged_id.eq.${userId})`,
      'order': 'created_at.desc',
      'limit': '20',
    },
  });

  if (!data || data.length === 0) {
    return getMockChallenges(userId);
  }

  return data;
}

/**
 * Create a new challenge
 */
export async function createChallenge(data: ChallengeInsert): Promise<Challenge | null> {
  if (!isConfigured()) return null;

  // Get challenger and challenged names
  const [challenger, challenged] = await Promise.all([
    supabaseRequest<{ full_name: string }>('user_profiles', {
      query: { id: `eq.${data.challenger_id}`, select: 'full_name' },
      single: true,
    }),
    supabaseRequest<{ full_name: string }>('user_profiles', {
      query: { id: `eq.${data.challenged_id}`, select: 'full_name' },
      single: true,
    }),
  ]);

  // Expires 24 hours after round date
  const expiresAt = new Date(data.round_date);
  expiresAt.setDate(expiresAt.getDate() + 1);
  expiresAt.setHours(23, 59, 59, 999);

  const result = await supabaseRequest<Challenge[]>('challenges', {
    method: 'POST',
    body: {
      ...data,
      challenger_name: challenger?.full_name ?? 'Unknown',
      challenged_name: challenged?.full_name ?? 'Unknown',
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    },
  });

  return result?.[0] ?? null;
}

/**
 * Respond to a challenge (accept/decline)
 */
export async function respondToChallenge(
  challengeId: string,
  accept: boolean
): Promise<boolean> {
  if (!isConfigured()) return false;

  const result = await supabaseRequest('challenges', {
    method: 'PATCH',
    query: { id: `eq.${challengeId}` },
    body: { status: accept ? 'accepted' : 'declined' },
  });

  return result !== null;
}

/**
 * Submit challenge score
 */
export async function submitChallengeScore(
  challengeId: string,
  userId: string,
  score: number
): Promise<boolean> {
  if (!isConfigured()) return false;

  // Get current challenge
  const challenge = await supabaseRequest<Challenge>('challenges', {
    query: { id: `eq.${challengeId}` },
    single: true,
  });

  if (!challenge) return false;

  const isChallenger = challenge.challenger_id === userId;
  const updates: Record<string, unknown> = isChallenger
    ? { challenger_score: score }
    : { challenged_score: score };

  // Check if both scores are now submitted
  const otherScore = isChallenger ? challenge.challenged_score : challenge.challenger_score;
  if (otherScore !== null) {
    // Determine winner
    const challengerFinal = isChallenger ? score : otherScore;
    const challengedFinal = isChallenger ? otherScore : score;

    if (challengerFinal < challengedFinal) {
      updates.winner_id = challenge.challenger_id;
    } else if (challengedFinal < challengerFinal) {
      updates.winner_id = challenge.challenged_id;
    }
    // Tie = no winner

    updates.status = 'completed';
  }

  const result = await supabaseRequest('challenges', {
    method: 'PATCH',
    query: { id: `eq.${challengeId}` },
    body: updates,
  });

  return result !== null;
}

/**
 * Get members for challenge selection
 */
export async function getMembersForChallenge(): Promise<
  Array<{ id: string; full_name: string; handicap_index: number | null }>
> {
  if (!isConfigured()) {
    return [
      { id: '1', full_name: 'Mike Johnson', handicap_index: 8.2 },
      { id: '2', full_name: 'Sarah Williams', handicap_index: 12.5 },
      { id: '3', full_name: 'Tom Richards', handicap_index: 5.1 },
      { id: '4', full_name: 'Lisa Chen', handicap_index: 18.3 },
      { id: '5', full_name: 'James Brown', handicap_index: 10.7 },
    ];
  }

  const data = await supabaseRequest<
    Array<{ id: string; full_name: string; handicap_index: number | null }>
  >('user_profiles', {
    query: {
      'select': 'id,full_name,handicap_index',
      'order': 'full_name.asc',
    },
  });

  return data ?? [];
}

/**
 * Mock challenges data
 */
function getMockChallenges(userId: string): Challenge[] {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return [
    {
      id: '1',
      challenger_id: userId,
      challenger_name: 'You',
      challenged_id: '2',
      challenged_name: 'Sarah Williams',
      round_date: today,
      challenge_type: 'net',
      status: 'pending',
      challenger_score: null,
      challenged_score: null,
      winner_id: null,
      message: "Let's see who can shoot the best net score today!",
      created_at: new Date().toISOString(),
      expires_at: tomorrow.toISOString(),
    },
    {
      id: '2',
      challenger_id: '3',
      challenger_name: 'Tom Richards',
      challenged_id: userId,
      challenged_name: 'You',
      round_date: today,
      challenge_type: 'gross',
      status: 'accepted',
      challenger_score: 76,
      challenged_score: null,
      winner_id: null,
      message: 'Gross score challenge - no handicaps!',
      created_at: new Date().toISOString(),
      expires_at: tomorrow.toISOString(),
    },
  ];
}
