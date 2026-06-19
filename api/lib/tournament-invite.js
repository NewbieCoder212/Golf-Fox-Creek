const { adminFetch, fetchWithTimeout } = require('./supabase-fetch');

function buildFullName(firstName, lastName) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function splitDisplayName(displayName) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Member', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function formatTournamentDates(startDate, endDate) {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const startKey = startDate.trim().slice(0, 10);
  const endKey = endDate.trim().slice(0, 10);
  const start = new Date(`${startKey}T12:00:00`);
  const end = new Date(`${endKey}T12:00:00`);
  if (startKey === endKey) return formatter.format(start);
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function buildTournamentDeepLink(tournamentId) {
  const base =
    process.env.TOURNAMENT_EMAIL_APP_URL?.trim() ??
    process.env.MEMBER_INVITE_REDIRECT_URL?.replace(/\/accept-invite$/, '') ??
    'https://www.foxcreek.golf';
  return `${base.replace(/\/$/, '')}/tournaments/${tournamentId}`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml(params) {
  const rosterList = (params.rosterNames ?? [])
    .map((name) => `<li style="margin:4px 0;">${escapeHtml(name)}</li>`)
    .join('');
  const ctaLabel = params.isPendingMember ? 'Set up your account' : 'View tournament';
  const hasTeam = Boolean(params.teamName?.trim());
  const teamBlock = hasTeam
    ? `<div style="background:#0c0c0c; border:1px solid #262626; border-radius:12px; padding:16px; margin:20px 0;">
        <p style="margin:0 0 4px; color:#a3a3a3; font-size:12px; text-transform:uppercase; letter-spacing:0.08em;">Team</p>
        <p style="margin:0 0 8px; font-size:18px; font-weight:700;">${escapeHtml(params.teamName ?? '')}</p>
        ${rosterList ? `<ul style="margin:0; padding-left:18px; color:#e5e5e5;">${rosterList}</ul>` : ''}
      </div>`
    : `<p style="color:#d4d4d4; line-height:1.5;">You're on the participant list. Team assignments and pairings may still be finalized — check back in the app for updates.</p>`;
  const introLine = hasTeam
    ? `Your team roster is set for <strong>${escapeHtml(params.tournamentName)}</strong> (${escapeHtml(params.tournamentDates)}).`
    : `You're registered for <strong>${escapeHtml(params.tournamentName)}</strong> (${escapeHtml(params.tournamentDates)}).`;

  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0c0c0c;color:#f5f5f5;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:16px;padding:24px;">
      <p style="color:#a3e635;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 8px;">Fox Creek Golf</p>
      <h1 style="margin:0 0 12px;font-size:24px;">You're on the roster</h1>
      <p style="color:#d4d4d4;line-height:1.5;">Hi ${escapeHtml(params.recipientName)},</p>
      <p style="color:#d4d4d4;line-height:1.5;">${introLine}</p>
      ${teamBlock}
      <a href="${escapeHtml(params.tournamentUrl)}" style="display:inline-block;background:#65a30d;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;">${ctaLabel}</a>
    </div></body></html>`;
}

function buildEmailText(params) {
  const lines = [
    `Hi ${params.recipientName},`,
    '',
    params.teamName
      ? `Your team roster is set for ${params.tournamentName} (${params.tournamentDates}).`
      : `You're registered for ${params.tournamentName} (${params.tournamentDates}).`,
  ];
  if (params.teamName) lines.push('', `Team: ${params.teamName}`);
  lines.push(
    '',
    params.isPendingMember
      ? `Set up your account: ${params.tournamentUrl}`
      : `View tournament: ${params.tournamentUrl}`
  );
  return lines.join('\n');
}

async function sendOnboardEmail(params) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.TOURNAMENT_EMAIL_FROM?.trim() ?? 'Fox Creek Golf <onboarding@foxcreek.golf>';
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY is not configured' };

  try {
    const response = await fetchWithTimeout(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: `You're on the roster — ${params.tournamentName}`,
          html: buildEmailHtml(params),
          text: buildEmailText(params),
        }),
      },
      15_000
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { sent: false, error: body.message ?? `Resend request failed (${response.status})` };
    }
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : 'Email service unreachable',
    };
  }
}

async function generateMagicLink(email, redirectTo) {
  const result = await adminFetch('/auth/v1/admin/generate_link', {
    method: 'POST',
    body: {
      type: 'magiclink',
      email: email.trim().toLowerCase(),
      options: { redirect_to: redirectTo },
    },
  });
  if (!result.ok) {
    throw new Error(result.data?.message ?? result.data?.msg ?? 'Could not generate signup link');
  }
  const properties = result.data?.properties;
  return result.data?.action_link ?? properties?.action_link ?? null;
}

function emailEqFilter(email) {
  return encodeURIComponent(email.trim().toLowerCase());
}

async function lookupAuthUserIdByEmail(email) {
  const normalized = email.trim().toLowerCase();
  const profileResult = await adminFetch(
    `/rest/v1/user_profiles?email=eq.${emailEqFilter(normalized)}&select=id&limit=1`
  );
  if (profileResult.ok && profileResult.data?.[0]?.id) {
    return profileResult.data[0].id;
  }

  const usersResult = await adminFetch('/auth/v1/admin/users?page=1&per_page=200', {}, 30_000);
  if (usersResult.ok && usersResult.data?.users) {
    const match = usersResult.data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalized
    );
    if (match?.id) return match.id;
  }
  return null;
}

async function createAuthUserInviteLink({ email, firstName, lastName, redirectTo }) {
  const result = await adminFetch('/auth/v1/admin/generate_link', {
    method: 'POST',
    body: {
      type: 'invite',
      email: email.trim().toLowerCase(),
      options: {
        redirect_to: redirectTo,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: buildFullName(firstName, lastName),
        },
      },
    },
  }, 30_000);

  if (!result.ok) {
    const message = result.data?.message ?? result.data?.msg ?? 'Could not create auth user';
    if (/already been registered|already exists|duplicate/i.test(String(message))) {
      const existingId = await lookupAuthUserIdByEmail(email);
      if (existingId) {
        return { userId: existingId, setupUrl: null };
      }
    }
    throw new Error(message);
  }

  const userId = result.data?.user?.id ?? result.data?.id;
  if (!userId) {
    throw new Error('Could not create auth user');
  }

  const properties = result.data?.properties;
  const setupUrl = result.data?.action_link ?? properties?.action_link ?? null;
  return { userId, setupUrl };
}

async function ensureUserProfile({ userId, email, firstName, lastName, inviteStatus = 'pending' }) {
  const existing = await adminFetch(
    `/rest/v1/user_profiles?id=eq.${userId}&select=id&limit=1`
  );
  if (existing.ok && existing.data?.[0]) {
    return;
  }

  const result = await adminFetch('/rest/v1/user_profiles', {
    method: 'POST',
    body: {
      id: userId,
      email: email.trim().toLowerCase(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: buildFullName(firstName, lastName),
      role: 'member',
      invite_status: inviteStatus,
    },
    prefer: 'return=minimal',
  });

  if (!result.ok) {
    throw new Error(result.data?.message ?? result.data?.msg ?? 'Could not create user profile');
  }
}

async function ensureAuthUserId({ email, firstName, lastName, redirectTo }) {
  const existingId = await lookupAuthUserIdByEmail(email);
  if (existingId) {
    await ensureUserProfile({ userId: existingId, email, firstName, lastName });
    return { userId: existingId, setupUrl: null };
  }

  try {
    const created = await createAuthUserInviteLink({ email, firstName, lastName, redirectTo });
    await ensureUserProfile({ userId: created.userId, email, firstName, lastName });
    return created;
  } catch (error) {
    const retryId = await lookupAuthUserIdByEmail(email);
    if (retryId) {
      await ensureUserProfile({ userId: retryId, email, firstName, lastName });
      return { userId: retryId, setupUrl: null };
    }
    throw error;
  }
}

async function sendParticipantInvite(tournamentId, playerId, { resend = false } = {}) {
  const inviteRedirect =
    process.env.MEMBER_INVITE_REDIRECT_URL?.trim() ?? 'https://www.foxcreek.golf/accept-invite';
  const tournamentUrl = buildTournamentDeepLink(tournamentId);
  const now = new Date().toISOString();

  const [tournamentResult, playerResult, teamsResult] = await Promise.all([
    adminFetch(
      `/rest/v1/tournaments?id=eq.${tournamentId}&select=id,name,start_date,end_date`
    ),
    adminFetch(
      `/rest/v1/tournament_players?id=eq.${playerId}&tournament_id=eq.${tournamentId}&select=id,display_name,user_id,email,invite_email_sent_at`
    ),
    adminFetch(
      `/rest/v1/tournament_teams?tournament_id=eq.${tournamentId}&select=id,team_name,side,player_ids`
    ),
  ]);

  if (!tournamentResult.ok || !tournamentResult.data?.[0]) {
    return { error: 'Tournament not found', status: 404 };
  }
  if (!playerResult.ok || !playerResult.data?.[0]) {
    return { error: 'Participant not found', status: 404 };
  }

  const tournament = tournamentResult.data[0];
  const player = playerResult.data[0];
  const teams = teamsResult.ok && teamsResult.data ? teamsResult.data : [];
  const team = teams.find((entry) => entry.player_ids?.includes(playerId));

  if (player.invite_email_sent_at && !resend) {
    return {
      error: 'Invite was already sent to this participant. Send again with resend enabled.',
      status: 409,
    };
  }

  let profile = null;
  if (player.user_id) {
    const profileResult = await adminFetch(
      `/rest/v1/user_profiles?id=eq.${player.user_id}&select=id,email,full_name,first_name,last_name,invite_status`
    );
    profile = profileResult.ok ? profileResult.data?.[0] ?? null : null;
  } else if (player.email?.trim()) {
    const profileResult = await adminFetch(
      `/rest/v1/user_profiles?email=eq.${emailEqFilter(player.email)}&select=id,email,full_name,first_name,last_name,invite_status`
    );
    profile = profileResult.ok ? profileResult.data?.[0] ?? null : null;
  }

  const email = profile?.email?.trim() ?? player.email?.trim() ?? null;
  if (!email) return { error: 'Participant has no email address', status: 400 };

  let rosterNames = [];
  if (team?.player_ids?.length) {
    const rosterResult = await adminFetch(
      `/rest/v1/tournament_players?id=in.(${team.player_ids.join(',')})&select=display_name`
    );
    if (rosterResult.ok && rosterResult.data) {
      rosterNames = rosterResult.data.map((entry) => entry.display_name);
    }
  }

  const recipientName =
    profile?.full_name?.trim() ||
    buildFullName(profile?.first_name ?? '', profile?.last_name ?? '') ||
    player.display_name;

  let linkedUserId = player.user_id ?? profile?.id ?? null;
  let isPendingMember = profile?.invite_status === 'pending';
  let invitesSent = 0;
  let accountSetupUrl = tournamentUrl;

  if (!linkedUserId) {
    const { firstName, lastName } = splitDisplayName(player.display_name);
    const ensured = await ensureAuthUserId({
      email,
      firstName,
      lastName,
      redirectTo: inviteRedirect,
    });
    linkedUserId = ensured.userId;
    isPendingMember = true;
    if (ensured.setupUrl) {
      accountSetupUrl = ensured.setupUrl;
    }
  }

  if (isPendingMember && accountSetupUrl === tournamentUrl) {
    const actionLink = await generateMagicLink(email, inviteRedirect);
    if (actionLink) {
      accountSetupUrl = actionLink;
      invitesSent += 1;
    } else {
      accountSetupUrl = inviteRedirect;
    }
  }

  if (!player.user_id && linkedUserId) {
    await adminFetch(`/rest/v1/tournament_players?id=eq.${player.id}`, {
      method: 'PATCH',
      body: { user_id: linkedUserId },
    });
  }

  const emailResult = await sendOnboardEmail({
    to: email,
    recipientName,
    tournamentName: tournament.name,
    tournamentDates: formatTournamentDates(tournament.start_date, tournament.end_date),
    teamName: team?.team_name ?? null,
    rosterNames,
    tournamentUrl: isPendingMember ? accountSetupUrl : tournamentUrl,
    isPendingMember,
  });

  if (!emailResult.sent) {
    return {
      error: emailResult.error ?? 'Email was not sent',
      status: 500,
      invitesSent,
      email,
    };
  }

  await adminFetch(`/rest/v1/tournament_players?id=eq.${player.id}`, {
    method: 'PATCH',
    body: { invite_email_sent_at: now },
  });

  return {
    success: true,
    emailed: 1,
    invitesSent,
    email,
    status: 200,
  };
}

async function finalizeParticipantInvites(tournamentId) {
  const now = new Date().toISOString();

  const teamsResult = await adminFetch(
    `/rest/v1/tournament_teams?tournament_id=eq.${tournamentId}&select=id,player_ids`
  );
  const teams = teamsResult.ok && teamsResult.data ? teamsResult.data : [];

  await adminFetch(`/rest/v1/tournaments?id=eq.${tournamentId}`, {
    method: 'PATCH',
    body: { participant_invites_sent_at: now },
  });

  for (const team of teams) {
    if ((team.player_ids?.length ?? 0) > 0) {
      await adminFetch(`/rest/v1/tournament_teams?id=eq.${team.id}`, {
        method: 'PATCH',
        body: {
          roster_status: 'ready',
          onboard_email_sent_at: now,
        },
      });
    }
  }

  return { success: true, status: 200 };
}

async function sendAllParticipantInvites(tournamentId) {
  const playersResult = await adminFetch(
    `/rest/v1/tournament_players?tournament_id=eq.${tournamentId}&select=id,display_name,user_id,email,invite_email_sent_at`
  );
  if (!playersResult.ok || !playersResult.data) {
    return { error: 'Could not load participants', status: 500 };
  }

  let emailed = 0;
  let invitesSent = 0;
  let skippedNoEmail = 0;
  let skippedAlreadySent = 0;
  const errors = [];
  const now = new Date().toISOString();

  for (const player of playersResult.data) {
    if (player.invite_email_sent_at) {
      skippedAlreadySent += 1;
      continue;
    }
    if (!player.email?.trim()) {
      skippedNoEmail += 1;
      continue;
    }

    const result = await sendParticipantInvite(tournamentId, player.id, { resend: false });
    if (result.success) {
      emailed += 1;
      invitesSent += result.invitesSent ?? 0;
    } else if (result.email) {
      errors.push(`${result.email}: ${result.error}`);
    }
  }

  const finalizeResult = await finalizeParticipantInvites(tournamentId);
  if (finalizeResult.error) {
    return finalizeResult;
  }

  return {
    success: true,
    emailed,
    invitesSent,
    skippedNoEmail,
    skippedAlreadySent,
    errors,
    status: 200,
  };
}

module.exports = { sendParticipantInvite, sendAllParticipantInvites, finalizeParticipantInvites };
