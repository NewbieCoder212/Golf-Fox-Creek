import { getSupabaseAdminClient } from './supabase-admin';

export type ParticipantOnboardingStatus =
  | 'no_email'
  | 'not_invited'
  | 'pending_setup'
  | 'ready'
  | 'awaiting_app_login'
  | 'logged_in';

export interface ParticipantOnboardingEntry {
  playerId: string;
  status: ParticipantOnboardingStatus;
  lastSignInAt: string | null;
  authActivityAt: string | null;
}

export interface ParticipantOnboardingSummary {
  total: number;
  noEmail: number;
  notInvited: number;
  pendingSetup: number;
  ready: number;
  awaitingAppLogin: number;
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

type ProfileSnapshot = {
  invite_status: 'pending' | 'active';
  last_member_sign_in_at: string | null;
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
  profile: ProfileSnapshot | null;
  authUser: AuthUserSnapshot | null;
}): {
  status: ParticipantOnboardingStatus;
  lastSignInAt: string | null;
  authActivityAt: string | null;
} {
  if (!params.email) {
    return { status: 'no_email', lastSignInAt: null, authActivityAt: null };
  }

  if (!params.inviteEmailSentAt) {
    return { status: 'not_invited', lastSignInAt: null, authActivityAt: null };
  }

  const authUser = params.authUser;
  const confirmed = Boolean(authUser?.email_confirmed_at);
  const pendingProfile = params.profile?.invite_status === 'pending';

  if (!authUser || pendingProfile || !confirmed) {
    return { status: 'pending_setup', lastSignInAt: null, authActivityAt: null };
  }

  const memberSignInAt = params.profile?.last_member_sign_in_at ?? null;
  if (memberSignInAt) {
    return {
      status: 'logged_in',
      lastSignInAt: memberSignInAt,
      authActivityAt: authUser.last_sign_in_at,
    };
  }

  if (authUser.last_sign_in_at) {
    return {
      status: 'awaiting_app_login',
      lastSignInAt: null,
      authActivityAt: authUser.last_sign_in_at,
    };
  }

  return { status: 'ready', lastSignInAt: null, authActivityAt: null };
}

function summaryKeyForStatus(status: ParticipantOnboardingStatus): keyof ParticipantOnboardingSummary {
  switch (status) {
    case 'no_email':
      return 'noEmail';
    case 'not_invited':
      return 'notInvited';
    case 'pending_setup':
      return 'pendingSetup';
    case 'ready':
      return 'ready';
    case 'awaiting_app_login':
      return 'awaitingAppLogin';
    case 'logged_in':
      return 'loggedIn';
  }
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

  const profileById = new Map<string, ProfileSnapshot>();
  const profileByEmail = new Map<string, ProfileSnapshot>();

  if (userIds.length > 0) {
    const { data: profilesById } = await supabase
      .from('user_profiles')
      .select('id,email,invite_status,last_member_sign_in_at')
      .in('id', userIds);

    for (const profile of profilesById ?? []) {
      if (!profile.id || !profile.invite_status) continue;
      const snapshot: ProfileSnapshot = {
        invite_status: profile.invite_status,
        last_member_sign_in_at: profile.last_member_sign_in_at ?? null,
      };
      profileById.set(profile.id, snapshot);
      const email = profile.email?.trim().toLowerCase();
      if (email) profileByEmail.set(email, snapshot);
    }
  }

  const missingEmails = emails.filter((email) => !profileByEmail.has(email));
  if (missingEmails.length > 0) {
    const { data: profilesByEmail } = await supabase
      .from('user_profiles')
      .select('id,email,invite_status,last_member_sign_in_at')
      .in('email', missingEmails);

    for (const profile of profilesByEmail ?? []) {
      const email = profile.email?.trim().toLowerCase();
      if (!email || !profile.invite_status) continue;
      profileByEmail.set(email, {
        invite_status: profile.invite_status,
        last_member_sign_in_at: profile.last_member_sign_in_at ?? null,
      });
    }
  }

  const summary: ParticipantOnboardingSummary = {
    total: players.length,
    noEmail: 0,
    notInvited: 0,
    pendingSetup: 0,
    ready: 0,
    awaitingAppLogin: 0,
    loggedIn: 0,
  };

  const entries: ParticipantOnboardingEntry[] = players.map((player) => {
    const email = player.email?.trim().toLowerCase() ?? null;
    const profile =
      (player.user_id ? profileById.get(player.user_id) : null) ??
      (email ? profileByEmail.get(email) : null) ??
      null;

    const resolved = resolveOnboardingStatus({
      email,
      inviteEmailSentAt: player.invite_email_sent_at,
      profile,
      authUser: email ? (authByEmail.get(email) ?? null) : null,
    });

    summary[summaryKeyForStatus(resolved.status)] += 1;

    return {
      playerId: player.id,
      status: resolved.status,
      lastSignInAt: resolved.lastSignInAt,
      authActivityAt: resolved.authActivityAt,
    };
  });

  return { summary, players: entries };
}
