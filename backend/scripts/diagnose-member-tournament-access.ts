/**
 * Diagnose why a member cannot see tournaments on the hub.
 * Run: cd backend && bun run scripts/diagnose-member-tournament-access.ts test.diapers.1@foxcreek.golf
 */

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
const TEST_PASSWORD = process.argv[3] ?? 'FoxCreek123!';
const EMAIL = (process.argv[2] ?? 'test.diapers.1@foxcreek.golf').trim().toLowerCase();

async function adminFetch<T>(path: string): Promise<T | null> {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Admin ${path} failed (${response.status}):`, text);
    return null;
  }
  return text ? (JSON.parse(text) as T) : null;
}

async function memberFetch<T>(path: string, accessToken: string): Promise<{ ok: boolean; data: T | null; status: number; body: string }> {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: ANON_KEY || SERVICE_ROLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const body = await response.text();
  const data = body ? (JSON.parse(body) as T) : null;
  return { ok: response.ok, data, status: response.status, body };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env');
    process.exit(1);
  }

  console.log(`\nDiagnosing tournament access for ${EMAIL}\n`);

  const users = await adminFetch<{ users: Array<{ id: string; email?: string }> }>(
    '/auth/v1/admin/users?page=1&per_page=200'
  );
  const authUser = users?.users?.find((u) => u.email?.toLowerCase() === EMAIL);
  if (!authUser?.id) {
    console.error('✗ No auth.users row for this email in this Supabase project.');
    process.exit(1);
  }
  console.log(`✓ auth.users id: ${authUser.id}`);

  const roster = await adminFetch<
    Array<{ id: string; tournament_id: string; user_id: string | null; display_name: string; email: string | null }>
  >(
    `/rest/v1/tournament_players?or=(user_id.eq.${authUser.id},email.eq.${EMAIL})&select=id,tournament_id,user_id,display_name,email`
  );

  if (!roster?.length) {
    console.error('✗ No tournament_players rows linked to this user or email.');
    console.error('  Run: bun run scripts/seed-test-players.ts against THIS Supabase project.');
    process.exit(1);
  }

  for (const row of roster) {
    const tournament = await adminFetch<Array<{ id: string; name: string; start_date: string; end_date: string }>>(
      `/rest/v1/tournaments?id=eq.${row.tournament_id}&select=id,name,start_date,end_date`
    );
    const t = tournament?.[0];
    console.log(`✓ Roster: ${row.display_name}`);
    console.log(`    player_id=${row.id}`);
    console.log(`    user_id=${row.user_id ?? 'NULL (not linked!)'}`);
    console.log(`    tournament=${t?.name ?? row.tournament_id} (${t?.start_date} – ${t?.end_date})`);
    if (row.user_id && row.user_id !== authUser.id) {
      console.error('  ✗ user_id on roster does NOT match auth.users id — re-link in admin or re-seed.');
    }
  }

  if (!ANON_KEY) {
    console.warn('\n· EXPO_PUBLIC_SUPABASE_ANON_KEY not set — skipping member JWT read probe');
    return;
  }

  const signIn = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: TEST_PASSWORD }),
  });
  const signInBody = await signIn.text();
  if (!signIn.ok) {
    console.error(`\n✗ Password sign-in failed (${signIn.status}):`, signInBody);
    console.error('  Default seed password is FoxCreek123!');
    process.exit(1);
  }

  const session = JSON.parse(signInBody) as { access_token: string };
  const memberRead = await memberFetch<
    Array<{ tournament_id: string; id: string }>
  >(
    `/rest/v1/tournament_players?user_id=eq.${authUser.id}&select=tournament_id,id`,
    session.access_token
  );

  if (!memberRead.ok) {
    console.error(`\n✗ Member JWT cannot read tournament_players (${memberRead.status}):`, memberRead.body);
    console.error('  Apply supabase/migrations/20260717000000_tournament_players_read_own.sql');
    process.exit(1);
  }

  console.log(`\n✓ Member JWT sees ${memberRead.data?.length ?? 0} roster row(s) — hub should list these tournaments.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
