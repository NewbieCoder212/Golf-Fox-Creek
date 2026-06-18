import { getSupabaseAdminClient } from './supabase-admin';

export type ParticipantOnboardingStatus =
  | 'no_email'
  | 'not_invited'
  | 'pending_setup'
  | 'ready'
  | 'logged_in';

export interface ParticipantOnboardingEntry {
  playerId: string;
  status: ParticipantOnboardingStatus;
  lastSignInAt: string | null;
}

export interface ParticipantOnboardingSummary {
  total: number;
  noEmail: number;
  notInvited: number;
  pendingSetup: number;
  ready: number;
  loggedIn: number;
}

export interface ParticipantOnboardingResult {
  summary: ParticipantOnboardingSummary;
  players: ParticipantOnboardingEntry[];
}

type AuthUserSnapshot = {
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
};

async function listAuthUsersByEmail(): Promise<Map<string, AuthUserSnapshot>> {
  const supabase = getSupabaseAdminClient();
  const byEmail = new Map<string, AuthUserSnapshot>();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw new Error(error.message);
    }

    for (const user of data.users) {
      const email = user.email?.trim().toLowerCase();
      if (!email) continue;
      byEmail.set(email, {
        email_confirmed_at: user.email_confirmed_at ?? null,
        last_sign_in_at: user.last_sign_in_at ?? null,
      });
    }

    if (data.users.length < 200) break;
    page += 1;
  }

  return byEmail;
}

function resolveOnboardingStatus(params: {
  email: string | null;
  inviteEmailSentAt: string | null;
  inviteStatus: 'pending' | 'active' | null;
  authUser: AuthUserSnapshot | null;
}): { status: ParticipantOnboardingStatus; lastSignInAt: string | null } {
  if (!params.email) {
    return { status: 'no_email', lastSignInAt: null };
  }

  if (!params.inviteEmailSentAt) {
    return { status: 'not_invited', lastSignInAt: null };
  }

  const authUser = params.authUser;
  const confirmed = Boolean(authUser?.email_confirmed_at);
  const pendingProfile = params.inviteStatus === 'pending';

  if (!authUser || pendingProfile || !confirmed) {
    return { status: 'pending_setup', lastSignInAt: null };
  }

  if (authUser.last_sign_in_at) {
    return { status: 'logged_in', lastSignInAt: authUser.last_sign_in_at };
  }

  return { status: 'ready', lastSignInAt: null };
}

export async function loadParticipantOnboarding(
  tournamentId: string
): Promise<ParticipantOnboardingResult> {
  const supabase = getSupabaseAdminClient();

  const [playersResult, authByEmail] = await Promise.all([
    supabase
      .from('tournament_players')
      .select('id,email,user_id,invite_email_sent_at')
      .eq('tournament_id', tournamentId)
      .order('display_name'),
    listAuthUsersByEmail(),
  ]);

  if (playersResult.error) {
    throw new Error(playersResult.error.message);
  }

  const players = playersResult.data ?? [];
  const userIds = players.map((player) => player.user_id).filter((id): id is string => Boolean(id));
  const emails = players
    .map((player) => player.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));

  const profileById = new Map<string, 'pending' | 'active'>();
  const profileStatusByEmail = new Map<string, 'pending' | 'active'>();

  if (userIds.length > 0) {
    const { data: profilesById } = await supabase
      .from('user_profiles')
      .select('id,email,invite_status')
      .in('id', userIds);

    for (const profile of profilesById ?? []) {
      if (profile.id && profile.invite_status) {
        profileById.set(profile.id, profile.invite_status);
      }
      const email = profile.email?.trim().toLowerCase();
      if (email && profile.invite_status) {
        profileStatusByEmail.set(email, profile.invite_status);
      }
    }
  }

  const missingEmails = emails.filter((email) => !profileStatusByEmail.has(email));
  if (missingEmails.length > 0) {
    const { data: profilesByEmail } = await supabase
      .from('user_profiles')
      .select('id,email,invite_status')
      .in('email', missingEmails);

    for (const profile of profilesByEmail ?? []) {
      const email = profile.email?.trim().toLowerCase();
      if (email && profile.invite_status) {
        profileStatusByEmail.set(email, profile.invite_status);
      }
    }
  }

  const summary: ParticipantOnboardingSummary = {
    total: players.length,
    noEmail: 0,
    notInvited: 0,
    pendingSetup: 0,
    ready: 0,
    loggedIn: 0,
  };

  const entries: ParticipantOnboardingEntry[] = players.map((player) => {
    const email = player.email?.trim().toLowerCase() ?? null;
    const inviteStatus =
      (player.user_id ? profileById.get(player.user_id) : null) ??
      (email ? profileStatusByEmail.get(email) : null) ??
      null;

    const resolved = resolveOnboardingStatus({
      email,
      inviteEmailSentAt: player.invite_email_sent_at,
      inviteStatus,
      authUser: email ? (authByEmail.get(email) ?? null) : null,
    });

    summary[
      resolved.status === 'no_email'
        ? 'noEmail'
        : resolved.status === 'not_invited'
          ? 'notInvited'
          : resolved.status === 'pending_setup'
            ? 'pendingSetup'
            : resolved.status === 'ready'
              ? 'ready'
              : 'loggedIn'
    ] += 1;

    return {
      playerId: player.id,
      status: resolved.status,
      lastSignInAt: resolved.lastSignInAt,
    };
  });

  return { summary, players: entries };
}
