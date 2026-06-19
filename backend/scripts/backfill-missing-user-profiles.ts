/**
 * Backfill user_profiles for auth users missing a profile row, and link tournament_players.
 * Run: cd backend && bun run scripts/backfill-missing-user-profiles.ts
 * Optional: --dry-run
 */

import './../src/env';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
const TOURNAMENT_ID = '107c086c-8edd-4859-aa54-7ec6a0e9daba';
const DRY_RUN = process.argv.includes('--dry-run');

type AuthUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  invited_at?: string | null;
  user_metadata?: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
  };
};

type TournamentPlayer = {
  id: string;
  email: string | null;
  display_name: string;
  user_id: string | null;
};

async function adminFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; prefer?: string } = {}
): Promise<{ ok: boolean; status: number; data: T }> {
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

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Member', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function buildFullName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function profileBodyFromUser(user: AuthUser, roster?: TournamentPlayer) {
  const email = user.email?.trim().toLowerCase() ?? '';
  const meta = user.user_metadata ?? {};
  let firstName = meta.first_name?.trim() ?? '';
  let lastName = meta.last_name?.trim() ?? '';
  let fullName =
    meta.full_name?.trim() ||
    buildFullName(firstName, lastName) ||
    roster?.display_name?.trim() ||
    '';

  if (!firstName && fullName) {
    const split = splitDisplayName(fullName);
    firstName = split.firstName;
    lastName = lastName || split.lastName;
  }

  if (!fullName) {
    fullName = buildFullName(firstName, lastName) || email.split('@')[0] || 'Member';
  }
  if (!firstName) {
    firstName = splitDisplayName(fullName).firstName;
  }
  if (!lastName) {
    lastName = splitDisplayName(fullName).lastName;
  }

  const inviteStatus =
    user.email_confirmed_at || !user.invited_at ? 'active' : 'pending';

  return {
    id: user.id,
    email,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    role: 'member',
    invite_status: inviteStatus,
  };
}

async function loadAllAuthUsers(): Promise<AuthUser[]> {
  const users: AuthUser[] = [];
  let page = 1;

  while (true) {
    const { ok, data } = await adminFetch<{ users?: AuthUser[] }>(
      `/auth/v1/admin/users?page=${page}&per_page=200`
    );
    if (!ok) throw new Error('Could not load auth users');
    const batch = data.users ?? [];
    users.push(...batch);
    if (batch.length < 200) break;
    page += 1;
  }

  return users;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env');
    process.exit(1);
  }

  console.log(`\nBackfill missing user_profiles${DRY_RUN ? ' (dry run)' : ''}\n`);

  const [authUsers, profiles, roster] = await Promise.all([
    loadAllAuthUsers(),
    adminFetch<Array<{ id: string }>>('/rest/v1/user_profiles?select=id').then((r) => r.data ?? []),
    adminFetch<TournamentPlayer[]>(
      `/rest/v1/tournament_players?tournament_id=eq.${TOURNAMENT_ID}&select=id,email,display_name,user_id`
    ).then((r) => r.data ?? []),
  ]);

  const profileIds = new Set(profiles.map((p) => p.id));
  const rosterByEmail = new Map(
    roster
      .filter((p) => p.email?.trim())
      .map((p) => [p.email!.trim().toLowerCase(), p])
  );

  const missing = authUsers.filter((u) => u.id && !profileIds.has(u.id));
  console.log(`Auth users: ${authUsers.length}`);
  console.log(`Existing profiles: ${profiles.length}`);
  console.log(`Missing profiles: ${missing.length}\n`);

  let created = 0;
  let linked = 0;
  const errors: string[] = [];

  for (const user of missing) {
    const email = user.email?.trim().toLowerCase() ?? '(no email)';
    const rosterRow = email !== '(no email)' ? rosterByEmail.get(email) : undefined;
    const body = profileBodyFromUser(user, rosterRow);

    if (DRY_RUN) {
      console.log(`Would create profile: ${email} → ${body.full_name}`);
      if (rosterRow && !rosterRow.user_id) {
        console.log(`  Would link tournament_players ${rosterRow.id}`);
      }
      continue;
    }

    const createResult = await adminFetch('/rest/v1/user_profiles', {
      method: 'POST',
      body,
      prefer: 'return=minimal',
    });

    if (!createResult.ok) {
      const msg = JSON.stringify(createResult.data);
      console.error(`✗ ${email}: ${msg}`);
      errors.push(`${email}: ${msg}`);
      continue;
    }

    created += 1;
    console.log(`✓ Profile: ${email} (${body.full_name})`);

    if (rosterRow && rosterRow.user_id !== user.id) {
      const linkResult = await adminFetch(
        `/rest/v1/tournament_players?id=eq.${rosterRow.id}`,
        {
          method: 'PATCH',
          body: { user_id: user.id },
          prefer: 'return=minimal',
        }
      );

      if (!linkResult.ok) {
        const msg = JSON.stringify(linkResult.data);
        console.error(`  ✗ Link roster: ${msg}`);
        errors.push(`link ${email}: ${msg}`);
      } else {
        linked += 1;
        console.log(`  ✓ Linked roster: ${rosterRow.display_name}`);
      }
    }
  }

  // Link any roster rows that already have profiles but user_id still null
  if (!DRY_RUN) {
    const { data: allProfiles } = await adminFetch<Array<{ id: string; email: string }>>(
      '/rest/v1/user_profiles?select=id,email'
    );
    const profileByEmail = new Map(
      (allProfiles ?? [])
        .filter((p) => p.email?.trim())
        .map((p) => [p.email.trim().toLowerCase(), p.id])
    );

    for (const player of roster) {
      if (player.user_id) continue;
      const email = player.email?.trim().toLowerCase();
      if (!email) continue;
      const userId = profileByEmail.get(email);
      if (!userId) continue;

      const linkResult = await adminFetch(`/rest/v1/tournament_players?id=eq.${player.id}`, {
        method: 'PATCH',
        body: { user_id: userId },
        prefer: 'return=minimal',
      });

      if (linkResult.ok) {
        linked += 1;
        console.log(`✓ Linked roster (existing profile): ${player.display_name}`);
      }
    }
  }

  console.log(`\nDone. Created ${created} profile(s), linked ${linked} roster row(s).`);
  if (errors.length) {
    console.error(`Errors: ${errors.length}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
