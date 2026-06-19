const { adminFetch } = require('./supabase-fetch');

function resolveOnboardingStatus(params) {
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

function summaryKeyForStatus(status) {
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
    default:
      return 'ready';
  }
}

async function listAuthUsersByEmail() {
  const byEmail = new Map();
  let page = 1;

  while (true) {
    const result = await adminFetch(`/auth/v1/admin/users?page=${page}&per_page=200`, {}, 30_000);
    if (!result.ok) {
      throw new Error(result.data?.message ?? 'Could not load auth users');
    }

    const users = result.data?.users ?? [];
    for (const user of users) {
      const email = user.email?.trim().toLowerCase();
      if (!email) continue;
      byEmail.set(email, {
        email_confirmed_at: user.email_confirmed_at ?? null,
        last_sign_in_at: user.last_sign_in_at ?? null,
      });
    }

    if (users.length < 200) break;
    page += 1;
  }

  return byEmail;
}

async function loadParticipantOnboarding(tournamentId) {
  const [playersResult, authByEmail] = await Promise.all([
    adminFetch(
      `/rest/v1/tournament_players?tournament_id=eq.${tournamentId}&select=id,email,user_id,invite_email_sent_at&order=display_name`
    ),
    listAuthUsersByEmail(),
  ]);

  if (!playersResult.ok || !playersResult.data) {
    throw new Error('Could not load participants');
  }

  const players = playersResult.data;
  const userIds = players.map((player) => player.user_id).filter(Boolean);
  const emails = players
    .map((player) => player.email?.trim().toLowerCase())
    .filter(Boolean);

  const profileById = new Map();
  const profileByEmail = new Map();

  if (userIds.length > 0) {
    const profilesById = await adminFetch(
      `/rest/v1/user_profiles?id=in.(${userIds.join(',')})&select=id,email,invite_status,last_member_sign_in_at`
    );
    if (profilesById.ok && profilesById.data) {
      for (const profile of profilesById.data) {
        if (!profile.id || !profile.invite_status) continue;
        const snapshot = {
          invite_status: profile.invite_status,
          last_member_sign_in_at: profile.last_member_sign_in_at ?? null,
        };
        profileById.set(profile.id, snapshot);
        const email = profile.email?.trim().toLowerCase();
        if (email) profileByEmail.set(email, snapshot);
      }
    }
  }

  const missingEmails = emails.filter((email) => !profileByEmail.has(email));
  if (missingEmails.length > 0) {
    const inList = missingEmails.map((email) => `"${email.replace(/"/g, '')}"`).join(',');
    const profilesByEmail = await adminFetch(
      `/rest/v1/user_profiles?email=in.(${inList})&select=id,email,invite_status,last_member_sign_in_at`
    );
    if (profilesByEmail.ok && profilesByEmail.data) {
      for (const profile of profilesByEmail.data) {
        const email = profile.email?.trim().toLowerCase();
        if (!email || !profile.invite_status) continue;
        profileByEmail.set(email, {
          invite_status: profile.invite_status,
          last_member_sign_in_at: profile.last_member_sign_in_at ?? null,
        });
      }
    }
  }

  const summary = {
    total: players.length,
    noEmail: 0,
    notInvited: 0,
    pendingSetup: 0,
    ready: 0,
    awaitingAppLogin: 0,
    loggedIn: 0,
  };

  const entries = players.map((player) => {
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

module.exports = { loadParticipantOnboarding };
