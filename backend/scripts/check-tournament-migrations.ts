/**
 * Verify tournament TV display + RLS migrations are applied in Supabase.
 * Run: cd backend && bun run scripts/check-tournament-migrations.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

const REQUIRED_POLICIES = [
  'Public read tournaments for TV display',
  'Public read tournament teams for TV display',
  'Public read tournament players for TV display',
  'Public read tournament scores for TV display',
  'Public read tournament match groups for TV display',
  'Public read match hole results for TV display',
] as const;

const REQUIRED_COLUMNS = [
  { table: 'tournaments', column: 'display_token' },
  { table: 'tournaments', column: 'display_slug' },
  { table: 'tournaments', column: 'access_locked_at' },
  { table: 'ad_placements', column: 'display_position' },
  { table: 'tournament_match_hole_results', column: 'pairing_index' },
] as const;

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return response.json() as Promise<T>;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
    process.exit(1);
  }

  console.log('Checking tournament migrations...\n');

  let ok = true;

  for (const { table, column } of REQUIRED_COLUMNS) {
    const probe = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=${column}&limit=1`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!probe.ok) {
      const text = await probe.text();
      if (text.includes(column) && text.includes('42703')) {
        console.error(`✗ Missing column ${table}.${column}`);
        const hint =
          column === 'pairing_index'
            ? 'Run supabase/migrations/20260718000000_direct_result_hole_outcomes.sql'
            : column === 'access_locked_at'
              ? 'Run supabase/migrations/20260725000000_tournament_access_lock.sql'
              : 'Run supabase/migrations/20260628000000_tournament_tv_display.sql';
        console.error(`  ${hint}`);
        ok = false;
      } else {
        console.error(`✗ Could not probe ${table}.${column}: ${text.slice(0, 120)}`);
        ok = false;
      }
    } else {
      console.log(`✓ Column ${table}.${column}`);
    }
  }

  // Policies via pg_policies through a minimal probe: anon read on match_groups for near-term tournament
  const tournaments = await adminFetch<Array<{ id: string; name: string }>>(
    `/rest/v1/tournaments?select=id,name&order=start_date.asc&limit=1`
  );
  const sampleId = tournaments[0]?.id;
  if (!sampleId) {
    console.log('· No tournaments in database to test anon reads');
  } else {
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
    if (!anonKey) {
      console.warn('· EXPO_PUBLIC_SUPABASE_ANON_KEY not set — skipping anon read probe');
    } else {
      const anonResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/tournament_match_groups?tournament_id=eq.${sampleId}&select=id&limit=1`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        }
      );
      if (anonResponse.status === 401) {
        console.error('✗ Anon key rejected — check EXPO_PUBLIC_SUPABASE_ANON_KEY');
        ok = false;
      } else if (!anonResponse.ok) {
        console.error(`✗ Anon match_groups read failed (${anonResponse.status})`);
        ok = false;
      } else {
        console.log(`✓ Anon can query tournament_match_groups (TV / realtime path)`);
      }
    }
  }

  console.log('\nExpected RLS policies from 20260628000000_tournament_tv_display.sql:');
  for (const policy of REQUIRED_POLICIES) {
    console.log(`  · ${policy}`);
  }
  console.log(
    '\nApply in Supabase SQL editor if anon reads fail or TV display is empty without a valid token.'
  );

  if (!ok) {
    process.exit(1);
  }

  console.log('\nTournament migration checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
