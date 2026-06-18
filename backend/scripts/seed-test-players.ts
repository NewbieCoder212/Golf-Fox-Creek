/**
 * Seed 4 scorecard test players for Generation Cup (Diapers vs Depends).
 * Run: cd backend && bun run scripts/seed-test-players.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

const TOURNAMENT_ID = '107c086c-8edd-4859-aa54-7ec6a0e9daba';
const TEAM_DIAPERS_ID = '2aaa152e-39bb-48aa-acbe-124e5a9787fa';
const TEAM_DEPENDS_ID = '59d449c8-04a2-4dcb-b274-13ea0e81d478';

const TEST_PASSWORD = 'FoxCreek123!';

const TEST_PLAYERS = [
  {
    email: 'test.diapers.1@foxcreek.golf',
    firstName: 'Alex',
    lastName: 'Diapers',
    displayName: 'Alex Diapers (Test)',
    teamId: TEAM_DIAPERS_ID,
    handicap: 8.5,
  },
  {
    email: 'test.diapers.2@foxcreek.golf',
    firstName: 'Blake',
    lastName: 'Diapers',
    displayName: 'Blake Diapers (Test)',
    teamId: TEAM_DIAPERS_ID,
    handicap: 12.0,
  },
  {
    email: 'test.depends.1@foxcreek.golf',
    firstName: 'Casey',
    lastName: 'Depends',
    displayName: 'Casey Depends (Test)',
    teamId: TEAM_DEPENDS_ID,
    handicap: 10.2,
  },
  {
    email: 'test.depends.2@foxcreek.golf',
    firstName: 'Dana',
    lastName: 'Depends',
    displayName: 'Dana Depends (Test)',
    teamId: TEAM_DEPENDS_ID,
    handicap: 15.4,
  },
] as const;

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
    (typeof data.msg === 'string' && data.msg) ||
    (typeof data.message === 'string' && data.message) ||
    (typeof data.error_description === 'string' && data.error_description) ||
    JSON.stringify(data)
  );
}

async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const { ok, data } = await adminFetch<{ users?: Array<{ id: string; email?: string }> }>(
    '/auth/v1/admin/users?page=1&per_page=200'
  );
  if (!ok) return null;
  const user = data.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return user?.id ? { id: user.id, email: user.email ?? email } : null;
}

async function ensureUserProfile(
  userId: string,
  player: (typeof TEST_PLAYERS)[number]
): Promise<void> {
  const { data: profiles } = await adminFetch<Array<{ id: string }>>(
    `/rest/v1/user_profiles?id=eq.${userId}&select=id`
  );

  const profileBody = {
    id: userId,
    full_name: player.displayName,
    first_name: player.firstName,
    last_name: player.lastName,
    email: player.email,
    handicap_index: player.handicap,
    invite_status: 'active',
    role: 'member',
  };

  if (profiles?.[0]) {
    await adminFetch(`/rest/v1/user_profiles?id=eq.${userId}`, {
      method: 'PATCH',
      body: profileBody,
      prefer: 'return=minimal',
    });
    return;
  }

  const { ok, data } = await adminFetch('/rest/v1/user_profiles', {
    method: 'POST',
    body: profileBody,
    prefer: 'return=minimal',
  });
  if (!ok) {
    throw new Error(`Create profile for ${player.email}: ${getError(data as Record<string, unknown>)}`);
  }
}

async function createOrUpdateAuthUser(player: (typeof TEST_PLAYERS)[number]): Promise<string> {
  const existing = await findUserByEmail(player.email);

  if (existing) {
    const { ok, data } = await adminFetch(`/auth/v1/admin/users/${existing.id}`, {
      method: 'PUT',
      body: {
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: {
          first_name: player.firstName,
          last_name: player.lastName,
          full_name: player.displayName,
        },
      },
    });
    if (!ok) throw new Error(`Update user ${player.email}: ${getError(data as Record<string, unknown>)}`);

    await ensureUserProfile(existing.id, player);

    console.log(`  ✓ Updated existing user: ${player.email}`);
    return existing.id;
  }

  const { ok, data } = await adminFetch<{ id?: string; user?: { id: string } }>(
    '/auth/v1/admin/users',
    {
      method: 'POST',
      body: {
        email: player.email,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: {
          first_name: player.firstName,
          last_name: player.lastName,
          full_name: player.displayName,
        },
      },
    }
  );

  if (!ok) throw new Error(`Create user ${player.email}: ${getError(data as Record<string, unknown>)}`);

  const userId = data.id ?? data.user?.id;
  if (!userId) throw new Error(`No user id returned for ${player.email}`);

  await ensureUserProfile(userId, player);

  console.log(`  ✓ Created user: ${player.email}`);
  return userId;
}

async function upsertTournamentPlayer(
  player: (typeof TEST_PLAYERS)[number],
  userId: string
): Promise<string> {
  const { data: existing } = await adminFetch<
    Array<{ id: string; display_name: string }>
  >(
    `/rest/v1/tournament_players?tournament_id=eq.${TOURNAMENT_ID}&user_id=eq.${userId}&select=id,display_name`
  );

  if (existing?.[0]) {
    await adminFetch(`/rest/v1/tournament_players?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      body: {
        display_name: player.displayName,
        handicap_index: player.handicap,
        email: player.email,
      },
      prefer: 'return=minimal',
    });
    console.log(`  ✓ Updated roster entry: ${player.displayName}`);
    return existing[0].id;
  }

  const { ok, data } = await adminFetch<Array<{ id: string }>>('/rest/v1/tournament_players', {
    method: 'POST',
    body: {
      tournament_id: TOURNAMENT_ID,
      display_name: player.displayName,
      handicap_index: player.handicap,
      user_id: userId,
      email: player.email,
    },
    prefer: 'return=representation',
  });

  if (!ok || !data?.[0]?.id) {
    throw new Error(`Create tournament player ${player.displayName}: ${getError(data as unknown as Record<string, unknown>)}`);
  }

  console.log(`  ✓ Created roster entry: ${player.displayName}`);
  return data[0].id;
}

async function addPlayerToTeam(teamId: string, rosterPlayerId: string): Promise<void> {
  const { data: teams } = await adminFetch<Array<{ id: string; player_ids: string[] }>>(
    `/rest/v1/tournament_teams?id=eq.${teamId}&select=id,player_ids`
  );
  const team = teams?.[0];
  if (!team) throw new Error(`Team not found: ${teamId}`);

  const ids = team.player_ids.filter((id) => id !== rosterPlayerId);
  ids.unshift(rosterPlayerId);

  await adminFetch(`/rest/v1/tournament_teams?id=eq.${teamId}`, {
    method: 'PATCH',
    body: { player_ids: ids, roster_status: 'ready' },
    prefer: 'return=minimal',
  });
}

async function setupMatchGroups(
  diapersPlayerIds: string[],
  dependsPlayerIds: string[]
): Promise<void> {
  const sideA = diapersPlayerIds.slice(0, 2);
  const sideB = dependsPlayerIds.slice(0, 2);

  if (sideA.length < 2 || sideB.length < 2) {
    throw new Error('Need 2 players per team for match groups');
  }

  const teeTimes = [
    '2026-06-19T11:00:00+00:00',
    '2026-06-19T13:30:00+00:00',
    '2026-06-19T16:00:00+00:00',
  ];

  const ROUND_FORMATS = ['best_ball', 'scramble', 'singles'] as const;

  for (let round = 1; round <= 3; round++) {
    const { data: existing } = await adminFetch<Array<{ id: string }>>(
      `/rest/v1/tournament_match_groups?tournament_id=eq.${TOURNAMENT_ID}&round_number=eq.${round}&select=id`
    );

    const payload = {
      tournament_id: TOURNAMENT_ID,
      round_number: round,
      format: ROUND_FORMATS[round - 1],
      side_a_team_id: TEAM_DIAPERS_ID,
      side_b_team_id: TEAM_DEPENDS_ID,
      side_a_player_ids: sideA,
      side_b_player_ids: sideB,
      tee_time: teeTimes[round - 1],
      starting_hole: 1,
      group_number: 1,
      notes: 'Scorecard UI test foursome',
    };

    if (existing?.[0]) {
      await adminFetch(`/rest/v1/tournament_match_groups?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        body: payload,
        prefer: 'return=minimal',
      });
      console.log(`  ✓ Updated match group for round ${round}`);
    } else {
      const { ok, data } = await adminFetch('/rest/v1/tournament_match_groups', {
        method: 'POST',
        body: payload,
        prefer: 'return=minimal',
      });
      if (!ok) throw new Error(`Create match group round ${round}: ${getError(data as Record<string, unknown>)}`);
      console.log(`  ✓ Created match group for round ${round}`);
    }
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
    process.exit(1);
  }

  console.log('\n🏌️  Seeding Generation Cup test players...\n');

  const rosterByTeam: Record<string, string[]> = {
    [TEAM_DIAPERS_ID]: [],
    [TEAM_DEPENDS_ID]: [],
  };

  for (const player of TEST_PLAYERS) {
    console.log(`\n${player.displayName} (${player.email})`);
    const userId = await createOrUpdateAuthUser(player);
    const rosterId = await upsertTournamentPlayer(player, userId);
    rosterByTeam[player.teamId]!.push(rosterId);
    await addPlayerToTeam(player.teamId, rosterId);
    console.log(`  ✓ Added to team roster`);
  }

  console.log('\nSetting up match groups (rounds 1–3)...');
  await setupMatchGroups(rosterByTeam[TEAM_DIAPERS_ID]!, rosterByTeam[TEAM_DEPENDS_ID]!);

  console.log('\n✅ Done! Test credentials:\n');
  console.log('Password for all accounts: FoxCreek123!\n');
  for (const p of TEST_PLAYERS) {
    const team = p.teamId === TEAM_DIAPERS_ID ? 'Diapers' : 'Depends';
    console.log(`  ${p.email}  →  Team ${team}`);
  }
  console.log('\nRound formats (Generation Cup):');
  console.log('  Round 1 — Best Ball');
  console.log('  Round 2 — Scramble');
  console.log('  Round 3 — Head-to-Head Singles');
  console.log('\nAdmin: log out of admin, sign in with any test email above to use member scorecard.');
  console.log('Or use Admin Dashboard → Member Hub Preview for hub UI simulation.\n');
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
