/**
 * Wipe all tournament scores and match results for Generation Cup (local dev reset).
 * Run: cd backend && bun run scripts/clear-generation-cup-scores.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

const TOURNAMENT_ID = '107c086c-8edd-4859-aa54-7ec6a0e9daba';

type AdminFetchResult<T> = { ok: boolean; status: number; data: T };

async function adminFetch<T = Record<string, unknown>>(
  path: string,
  options: { method?: string; body?: unknown; prefer?: string } = {}
): Promise<AdminFetchResult<T>> {
  const headers: Record<string, string> = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (options.prefer) headers.Prefer = options.prefer;

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = (text ? JSON.parse(text) : null) as T;
  return { ok: response.ok, status: response.status, data };
}

function getError(data: Record<string, unknown>): string {
  return (
    (typeof data.message === 'string' && data.message) ||
    (typeof data.msg === 'string' && data.msg) ||
    JSON.stringify(data)
  );
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
    process.exit(1);
  }

  console.log(`Clearing scores for tournament ${TOURNAMENT_ID}…`);

  const groupsRes = await adminFetch<Array<{ id: string; round_number: number }>>(
    `/rest/v1/tournament_match_groups?tournament_id=eq.${TOURNAMENT_ID}&select=id,round_number`
  );
  if (!groupsRes.ok) {
    console.error('Failed to load match groups:', getError(groupsRes.data as Record<string, unknown>));
    process.exit(1);
  }

  const groupIds = groupsRes.data.map((g) => g.id);
  console.log(`Found ${groupIds.length} match groups`);

  const scoresRes = await adminFetch<unknown>(
    `/rest/v1/tournament_scores?tournament_id=eq.${TOURNAMENT_ID}`,
    { method: 'DELETE', prefer: 'return=representation' }
  );
  if (!scoresRes.ok) {
    console.error('Failed to delete scores:', getError(scoresRes.data as Record<string, unknown>));
    process.exit(1);
  }
  const deletedScores = Array.isArray(scoresRes.data) ? scoresRes.data.length : 0;
  console.log(`Deleted ${deletedScores} score rows`);

  if (groupIds.length > 0) {
    const holeRes = await adminFetch<unknown>(
      `/rest/v1/tournament_match_hole_results?match_group_id=in.(${groupIds.join(',')})`,
      { method: 'DELETE', prefer: 'return=representation' }
    );
    if (!holeRes.ok) {
      console.error('Failed to delete hole results:', getError(holeRes.data as Record<string, unknown>));
      process.exit(1);
    }
    const deletedHoles = Array.isArray(holeRes.data) ? holeRes.data.length : 0;
    console.log(`Deleted ${deletedHoles} hole result rows`);

    for (const group of groupsRes.data) {
      const patchRes = await adminFetch<unknown>(
        `/rest/v1/tournament_match_groups?id=eq.${group.id}`,
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
        console.error(`Failed to reset match group ${group.id}:`, getError(patchRes.data as Record<string, unknown>));
        process.exit(1);
      }
    }
    console.log(`Reset ${groupIds.length} match groups`);
  }

  console.log('Done — Generation Cup scores cleared.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
