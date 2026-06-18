import { Hono } from 'hono';
import { adminFetch, getErrorMessage, isSupabaseAdminConfigured } from '../lib/supabase-admin';
import {
  buildTournamentDeepLink,
  sendTournamentOnboardEmail,
} from '../lib/tournament-email';
import { requireManagerAuth, type AuthUser } from '../middleware/auth';

type TournamentTeamsEnv = {
  Variables: {
    authUser: AuthUser;
  };
};

const tournamentTeamsRouter = new Hono<TournamentTeamsEnv>();

type TournamentRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  participant_invites_sent_at?: string | null;
};

type TeamRow = {
  id: string;
  tournament_id: string;
  team_name: string;
  side: 'side_a' | 'side_b' | null;
  player_ids: string[];
  captain_user_id: string | null;
  captain_player_id?: string | null;
  roster_status: 'draft' | 'ready';
  onboard_email_sent_at: string | null;
};

type TournamentPlayerRow = {
  id: string;
  display_name: string;
  user_id: string | null;
  email?: string | null;
  invite_email_sent_at?: string | null;
};

type UserProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  invite_status: 'pending' | 'active';
};

function buildFullName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function formatTournamentDates(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  if (startDate === endDate) return formatter.format(start);
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

async function generateInviteLink(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  redirectTo: string;
}): Promise<void> {
  const fullName =
    params.firstName && params.lastName
      ? buildFullName(params.firstName, params.lastName)
      : undefined;

  const { ok, data } = await adminFetch<Record<string, unknown>>('/auth/v1/admin/generate_link', {
    method: 'POST',
    body: {
      type: 'invite',
      email: params.email.trim().toLowerCase(),
      options: {
        redirect_to: params.redirectTo,
        data: fullName
          ? {
              first_name: params.firstName,
              last_name: params.lastName,
              full_name: fullName,
            }
          : undefined,
      },
    },
  });

  if (!ok) {
    throw new Error(getErrorMessage(data));
  }
}

tournamentTeamsRouter.use('*', async (c, next) => {
  if (!isSupabaseAdminConfigured()) {
    return c.json({ error: 'Tournament team service is not configured' }, 503);
  }
  await next();
});

tournamentTeamsRouter.patch(
  '/:tournamentId/teams/:teamId',
  requireManagerAuth,
  async (c) => {
    const tournamentId = c.req.param('tournamentId');
    const teamId = c.req.param('teamId');

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid request body' }, 400);
    }

    const updates: Record<string, unknown> = {};

    if (typeof body.team_name === 'string') {
      const teamName = body.team_name.trim();
      if (!teamName) {
        return c.json({ error: 'Team name is required' }, 400);
      }
      updates.team_name = teamName;
    }

    if ('captain_user_id' in body) {
      updates.captain_user_id =
        typeof body.captain_user_id === 'string' ? body.captain_user_id : null;
    }

    if ('captain_player_id' in body) {
      updates.captain_player_id =
        typeof body.captain_player_id === 'string' ? body.captain_player_id : null;
    }

    if ('player_ids' in body) {
      if (!Array.isArray(body.player_ids)) {
        return c.json({ error: 'player_ids must be an array' }, 400);
      }
      updates.player_ids = body.player_ids.filter((id): id is string => typeof id === 'string');
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'No valid updates provided' }, 400);
    }

    const patchResult = await adminFetch<TeamRow[]>(
      `/rest/v1/tournament_teams?id=eq.${teamId}&tournament_id=eq.${tournamentId}&select=*`,
      {
        method: 'PATCH',
        body: updates,
        prefer: 'return=representation',
      }
    );

    if (!patchResult.ok) {
      const details = getErrorMessage(patchResult.data as unknown as Record<string, unknown>);
      console.error('[TournamentTeams] PATCH failed:', details);
      return c.json(
        {
          error:
            details.includes('captain_player_id') && details.includes('column')
              ? 'Database missing captain_player_id column. Run migration 20260716000000_tournament_team_captain_player.sql'
              : `Team was not updated: ${details}`,
        },
        500
      );
    }

    const updated = Array.isArray(patchResult.data) ? patchResult.data[0] : null;
    if (!updated) {
      return c.json({ error: 'Team not found' }, 404);
    }

    return c.json(updated);
  }
);

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Member', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

async function inviteUserByEmail(params: {
  email: string;
  firstName: string;
  lastName: string;
  redirectTo: string;
}): Promise<{ userId: string }> {
  const fullName = buildFullName(params.firstName, params.lastName);

  const { ok, data } = await adminFetch<Record<string, unknown>>('/auth/v1/invite', {
    method: 'POST',
    body: {
      email: params.email.trim().toLowerCase(),
      data: {
        first_name: params.firstName.trim(),
        last_name: params.lastName.trim(),
        full_name: fullName,
      },
      redirect_to: params.redirectTo,
    },
  });

  if (!ok) {
    throw new Error(getErrorMessage(data));
  }

  const user = data.user as { id?: string } | undefined;
  const userId = user?.id ?? (typeof data.id === 'string' ? data.id : null);

  if (!userId) {
    throw new Error('Invite succeeded but no user id returned');
  }

  return { userId };
}

type ParticipantInviteContext = {
  inviteRedirect: string;
  tournamentUrl: string;
  tournament: TournamentRow;
  tournamentDates: string;
  teamByPlayerId: Map<string, TeamRow>;
  allPlayers: TournamentPlayerRow[];
  profileById: Map<string, UserProfileRow>;
  profilesByEmail: Map<string, UserProfileRow>;
};

type ParticipantInviteAttemptResult = {
  emailed: boolean;
  invitesSent: number;
  email?: string;
  error?: string;
  skippedAlreadySent?: boolean;
  skippedNoEmail?: boolean;
};

async function loadParticipantInviteContext(
  tournamentId: string
): Promise<{ context: ParticipantInviteContext } | { error: string; status: number }> {
  const inviteRedirect =
    process.env.MEMBER_INVITE_REDIRECT_URL?.trim() ?? 'http://localhost:8081/accept-invite';
  const tournamentUrl = buildTournamentDeepLink(tournamentId);

  const tournamentResult = await adminFetch<TournamentRow[]>(
    `/rest/v1/tournaments?id=eq.${tournamentId}&select=id,name,start_date,end_date,participant_invites_sent_at`
  );
  if (!tournamentResult.ok || !tournamentResult.data?.[0]) {
    return { error: 'Tournament not found', status: 404 };
  }
  const tournament = tournamentResult.data[0];
  const tournamentDates = formatTournamentDates(tournament.start_date, tournament.end_date);

  const playersResult = await adminFetch<TournamentPlayerRow[]>(
    `/rest/v1/tournament_players?tournament_id=eq.${tournamentId}&select=id,display_name,user_id,email,invite_email_sent_at`
  );
  if (!playersResult.ok || !playersResult.data) {
    return { error: 'Could not load participants', status: 500 };
  }

  const teamsResult = await adminFetch<TeamRow[]>(
    `/rest/v1/tournament_teams?tournament_id=eq.${tournamentId}&select=id,team_name,side,player_ids`
  );
  if (!teamsResult.ok || !teamsResult.data) {
    return { error: 'Could not load teams', status: 500 };
  }

  const teamByPlayerId = new Map<string, TeamRow>();
  for (const team of teamsResult.data) {
    for (const playerId of team.player_ids ?? []) {
      teamByPlayerId.set(playerId, team);
    }
  }

  const userIds = playersResult.data
    .map((player) => player.user_id)
    .filter((id): id is string => Boolean(id));

  let profiles: UserProfileRow[] = [];
  if (userIds.length > 0) {
    const profilesResult = await adminFetch<UserProfileRow[]>(
      `/rest/v1/user_profiles?id=in.(${userIds.join(',')})&select=id,email,full_name,first_name,last_name,invite_status`
    );
    if (profilesResult.ok && profilesResult.data) {
      profiles = profilesResult.data;
    }
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const emailsToLookup = playersResult.data
    .filter((player) => !player.user_id && player.email?.trim())
    .map((player) => player.email!.trim().toLowerCase());

  let profilesByEmail = new Map<string, UserProfileRow>();
  if (emailsToLookup.length > 0) {
    const inList = emailsToLookup.map((email) => `"${email.replace(/"/g, '')}"`).join(',');
    const byEmailResult = await adminFetch<UserProfileRow[]>(
      `/rest/v1/user_profiles?email=in.(${inList})&select=id,email,full_name,first_name,last_name,invite_status`
    );
    if (byEmailResult.ok && byEmailResult.data) {
      profilesByEmail = new Map(
        byEmailResult.data.map((profile) => [profile.email?.toLowerCase() ?? '', profile])
      );
    }
  }

  return {
    context: {
      inviteRedirect,
      tournamentUrl,
      tournament,
      tournamentDates,
      teamByPlayerId,
      allPlayers: playersResult.data,
      profileById,
      profilesByEmail,
    },
  };
}

async function sendParticipantInviteForPlayer(
  player: TournamentPlayerRow,
  context: ParticipantInviteContext,
  options: { allowResend?: boolean; now?: string } = {}
): Promise<ParticipantInviteAttemptResult> {
  const now = options.now ?? new Date().toISOString();

  if (player.invite_email_sent_at && !options.allowResend) {
    return { emailed: false, invitesSent: 0, skippedAlreadySent: true };
  }

  let profile = player.user_id ? context.profileById.get(player.user_id) : null;
  let email = profile?.email?.trim() ?? player.email?.trim() ?? null;

  if (!email && player.email?.trim()) {
    const byEmail = context.profilesByEmail.get(player.email.trim().toLowerCase());
    if (byEmail) {
      profile = byEmail;
      email = byEmail.email?.trim() ?? player.email.trim();
    }
  }

  if (!email) {
    return { emailed: false, invitesSent: 0, skippedNoEmail: true };
  }

  const team = context.teamByPlayerId.get(player.id);
  const rosterNames = team
    ? context.allPlayers
        .filter((entry) => team.player_ids.includes(entry.id))
        .map((entry) => entry.display_name)
    : [];

  const recipientName =
    profile?.full_name?.trim() ||
    buildFullName(profile?.first_name ?? '', profile?.last_name ?? '') ||
    player.display_name;

  let isPendingMember = profile?.invite_status === 'pending';
  let linkedUserId = player.user_id ?? profile?.id ?? null;
  let invitesSent = 0;

  try {
    if (!linkedUserId) {
      const { firstName, lastName } = splitDisplayName(player.display_name);
      const invited = await inviteUserByEmail({
        email,
        firstName,
        lastName,
        redirectTo: context.inviteRedirect,
      });
      linkedUserId = invited.userId;
      invitesSent += 1;
      isPendingMember = true;
    } else if (profile?.invite_status === 'pending') {
      const { firstName, lastName } = splitDisplayName(recipientName);
      await generateInviteLink({
        email,
        firstName,
        lastName,
        redirectTo: context.inviteRedirect,
      });
      invitesSent += 1;
    }

    if (!player.user_id && linkedUserId) {
      await adminFetch(`/rest/v1/tournament_players?id=eq.${player.id}`, {
        method: 'PATCH',
        body: { user_id: linkedUserId },
      });
    }

    const emailResult = await sendTournamentOnboardEmail({
      to: email,
      recipientName,
      tournamentName: context.tournament.name,
      tournamentDates: context.tournamentDates,
      teamName: team?.team_name ?? null,
      teamSideLabel: null,
      rosterNames,
      tournamentUrl: isPendingMember ? context.inviteRedirect : context.tournamentUrl,
      isPendingMember,
    });

    if (emailResult.sent) {
      await adminFetch(`/rest/v1/tournament_players?id=eq.${player.id}`, {
        method: 'PATCH',
        body: { invite_email_sent_at: now },
      });
      return { emailed: true, invitesSent, email };
    }

    return {
      emailed: false,
      invitesSent,
      email,
      error: emailResult.error ?? 'Email was not sent',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email failed';
    return { emailed: false, invitesSent, email, error: message };
  }
}

tournamentTeamsRouter.patch(
  '/:tournamentId/participants/:playerId',
  requireManagerAuth,
  async (c) => {
    const tournamentId = c.req.param('tournamentId');
    const playerId = c.req.param('playerId');
    const body = await c.req.json<{
      display_name?: string;
      email?: string | null;
      handicap_index?: number | null;
      user_id?: string | null;
    }>();

    const playerResult = await adminFetch<TournamentPlayerRow[]>(
      `/rest/v1/tournament_players?id=eq.${playerId}&tournament_id=eq.${tournamentId}&select=id,user_id,email`
    );
    if (!playerResult.ok || !playerResult.data?.[0]) {
      return c.json({ error: 'Participant not found' }, 404);
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.display_name === 'string') {
      const trimmed = body.display_name.trim();
      if (!trimmed) {
        return c.json({ error: 'Name is required' }, 400);
      }
      updates.display_name = trimmed;
    }
    if (body.email !== undefined) {
      if (body.email === null || body.email === '') {
        updates.email = null;
      } else if (typeof body.email === 'string') {
        updates.email = body.email.trim().toLowerCase();
      }
    }
    if (body.handicap_index !== undefined) {
      updates.handicap_index = body.handicap_index;
    }
    if (body.user_id !== undefined) {
      updates.user_id = typeof body.user_id === 'string' ? body.user_id : null;
    }

    const existingPlayer = playerResult.data[0];
    const resolvedEmail =
      typeof updates.email === 'string'
        ? updates.email
        : existingPlayer.email?.trim().toLowerCase() ?? null;

    if (!updates.user_id && resolvedEmail) {
      const profileResult = await adminFetch<Array<{ id: string }>>(
        `/rest/v1/user_profiles?email=eq.${encodeURIComponent(resolvedEmail)}&select=id&limit=1`
      );
      if (profileResult.ok && profileResult.data?.[0]?.id) {
        updates.user_id = profileResult.data[0].id;
      }
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'No updates provided' }, 400);
    }

    const patchResult = await adminFetch<TournamentPlayerRow[]>(
      `/rest/v1/tournament_players?id=eq.${playerId}&tournament_id=eq.${tournamentId}`,
      {
        method: 'PATCH',
        body: updates,
        prefer: 'return=representation',
      }
    );

    if (!patchResult.ok) {
      return c.json({ error: 'Could not update participant' }, 500);
    }

    const updated = Array.isArray(patchResult.data) ? patchResult.data[0] : null;
    if (!updated) {
      return c.json({ error: 'Participant was not updated' }, 500);
    }

    return c.json(updated);
  }
);

tournamentTeamsRouter.delete(
  '/:tournamentId/participants/:playerId',
  requireManagerAuth,
  async (c) => {
    const tournamentId = c.req.param('tournamentId');
    const playerId = c.req.param('playerId');

    const playerResult = await adminFetch<TournamentPlayerRow[]>(
      `/rest/v1/tournament_players?id=eq.${playerId}&tournament_id=eq.${tournamentId}&select=id`
    );
    if (!playerResult.ok || !playerResult.data?.[0]) {
      return c.json({ error: 'Participant not found' }, 404);
    }

    const teamsResult = await adminFetch<TeamRow[]>(
      `/rest/v1/tournament_teams?tournament_id=eq.${tournamentId}&select=id,player_ids`
    );
    if (teamsResult.ok && teamsResult.data) {
      for (const team of teamsResult.data) {
        if (!team.player_ids?.includes(playerId)) continue;
        const nextIds = team.player_ids.filter((id) => id !== playerId);
        await adminFetch(`/rest/v1/tournament_teams?id=eq.${team.id}`, {
          method: 'PATCH',
          body: { player_ids: nextIds },
        });
      }
    }

    type MatchGroupRow = {
      id: string;
      side_a_player_ids: string[];
      side_b_player_ids: string[];
    };

    const matchGroupsResult = await adminFetch<MatchGroupRow[]>(
      `/rest/v1/tournament_match_groups?tournament_id=eq.${tournamentId}&select=id,side_a_player_ids,side_b_player_ids`
    );
    if (matchGroupsResult.ok && matchGroupsResult.data) {
      for (const group of matchGroupsResult.data) {
        const nextA = group.side_a_player_ids.filter((id) => id !== playerId);
        const nextB = group.side_b_player_ids.filter((id) => id !== playerId);
        if (
          nextA.length !== group.side_a_player_ids.length ||
          nextB.length !== group.side_b_player_ids.length
        ) {
          await adminFetch(`/rest/v1/tournament_match_groups?id=eq.${group.id}`, {
            method: 'PATCH',
            body: {
              side_a_player_ids: nextA,
              side_b_player_ids: nextB,
            },
          });
        }
      }
    }

    const deleteResult = await adminFetch<TournamentPlayerRow[]>(
      `/rest/v1/tournament_players?id=eq.${playerId}&tournament_id=eq.${tournamentId}`,
      { method: 'DELETE' }
    );

    if (!deleteResult.ok) {
      return c.json({ error: 'Could not delete participant' }, 500);
    }

    return c.json({ success: true });
  }
);

tournamentTeamsRouter.post(
  '/:tournamentId/participants/:playerId/send-invite',
  requireManagerAuth,
  async (c) => {
    const tournamentId = c.req.param('tournamentId');
    const playerId = c.req.param('playerId');

    let resend = false;
    try {
      const body = await c.req.json<{ resend?: boolean }>();
      resend = body.resend === true;
    } catch {
      // Empty body is fine for first-time sends.
    }

    const loaded = await loadParticipantInviteContext(tournamentId);
    if ('error' in loaded) {
      return c.json({ error: loaded.error }, loaded.status as 404 | 500);
    }

    const player = loaded.context.allPlayers.find((entry) => entry.id === playerId);
    if (!player) {
      return c.json({ error: 'Participant not found' }, 404);
    }

    if (player.invite_email_sent_at && !resend) {
      return c.json(
        {
          error: 'Invite was already sent to this participant. Send again with resend enabled.',
          skippedAlreadySent: true,
        },
        409
      );
    }

    const result = await sendParticipantInviteForPlayer(player, loaded.context, {
      allowResend: resend,
    });

    if (result.skippedNoEmail) {
      return c.json({ error: 'Participant has no email address' }, 400);
    }

    if (!result.emailed) {
      return c.json(
        {
          error: result.error ?? 'Could not send invite',
          invitesSent: result.invitesSent,
          email: result.email,
        },
        500
      );
    }

    return c.json({
      success: true,
      emailed: 1,
      invitesSent: result.invitesSent,
      email: result.email,
    });
  }
);

tournamentTeamsRouter.post(
  '/:tournamentId/send-participant-invites',
  requireManagerAuth,
  async (c) => {
    const tournamentId = c.req.param('tournamentId');

    const loaded = await loadParticipantInviteContext(tournamentId);
    if ('error' in loaded) {
      return c.json({ error: loaded.error }, loaded.status as 404 | 500);
    }

    const { context } = loaded;

    let emailed = 0;
    let invitesSent = 0;
    let skippedNoEmail = 0;
    let skippedAlreadySent = 0;
    const errors: string[] = [];
    const now = new Date().toISOString();

    for (const player of context.allPlayers) {
      const result = await sendParticipantInviteForPlayer(player, context, { now });

      if (result.skippedAlreadySent) {
        skippedAlreadySent += 1;
        continue;
      }
      if (result.skippedNoEmail) {
        skippedNoEmail += 1;
        continue;
      }

      invitesSent += result.invitesSent;
      if (result.emailed) {
        emailed += 1;
      } else if (result.error && result.email) {
        errors.push(`${result.email}: ${result.error}`);
      }
    }

    const teamsResult = await adminFetch<TeamRow[]>(
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

    return c.json({
      emailed,
      invitesSent,
      skippedNoEmail,
      skippedAlreadySent,
      errors,
    });
  }
);

tournamentTeamsRouter.post(
  '/:tournamentId/teams/:teamId/mark-ready-and-notify',
  requireManagerAuth,
  async (c) => {
    const tournamentId = c.req.param('tournamentId');
    const teamId = c.req.param('teamId');
    const authUser = c.get('authUser');

    const inviteRedirect =
      process.env.MEMBER_INVITE_REDIRECT_URL?.trim() ?? 'http://localhost:8081/accept-invite';
    const tournamentUrl = buildTournamentDeepLink(tournamentId);

    const teamResult = await adminFetch<TeamRow[]>(
      `/rest/v1/tournament_teams?id=eq.${teamId}&tournament_id=eq.${tournamentId}&select=*`
    );
    if (!teamResult.ok || !teamResult.data?.[0]) {
      return c.json({ error: 'Team not found' }, 404);
    }

    const team = teamResult.data[0];

    if (!team.captain_user_id && !team.captain_player_id) {
      return c.json({ error: 'Assign a captain before marking the roster ready' }, 400);
    }
    if (!team.player_ids?.length) {
      return c.json({ error: 'Add at least one player to the roster' }, 400);
    }
    if (team.roster_status !== 'draft') {
      return c.json({ error: 'Roster is already marked ready' }, 400);
    }
    if (team.onboard_email_sent_at) {
      return c.json({ error: 'Onboard email was already sent for this team' }, 400);
    }

    const tournamentResult = await adminFetch<TournamentRow[]>(
      `/rest/v1/tournaments?id=eq.${tournamentId}&select=id,name,start_date,end_date`
    );
    if (!tournamentResult.ok || !tournamentResult.data?.[0]) {
      return c.json({ error: 'Tournament not found' }, 404);
    }
    const tournament = tournamentResult.data[0];

    const playersResult = await adminFetch<TournamentPlayerRow[]>(
      `/rest/v1/tournament_players?id=in.(${team.player_ids.join(',')})&select=id,display_name,user_id`
    );
    if (!playersResult.ok || !playersResult.data) {
      return c.json({ error: 'Could not load roster players' }, 500);
    }

    const rosterPlayers = playersResult.data;
    const memberUserIds = rosterPlayers
      .map((player) => player.user_id)
      .filter((userId): userId is string => Boolean(userId));

    let profiles: UserProfileRow[] = [];
    if (memberUserIds.length > 0) {
      const profilesResult = await adminFetch<UserProfileRow[]>(
        `/rest/v1/user_profiles?id=in.(${memberUserIds.join(',')})&select=id,email,full_name,first_name,last_name,invite_status`
      );
      if (!profilesResult.ok || !profilesResult.data) {
        return c.json({ error: 'Could not load member profiles' }, 500);
      }
      profiles = profilesResult.data;
    }

    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const rosterNames = rosterPlayers.map((player) => player.display_name);
    const teamSideLabel = null;
    const tournamentDates = formatTournamentDates(tournament.start_date, tournament.end_date);

    let emailed = 0;
    let invitesSent = 0;
    let skippedGuests = 0;
    const errors: string[] = [];

    for (const player of rosterPlayers) {
      if (!player.user_id) {
        skippedGuests += 1;
        continue;
      }

      const profile = profileById.get(player.user_id);
      if (!profile?.email) {
        skippedGuests += 1;
        continue;
      }

      const recipientName =
        profile.full_name?.trim() ||
        buildFullName(profile.first_name ?? '', profile.last_name ?? '') ||
        player.display_name;

      try {
        if (profile.invite_status === 'pending') {
          await generateInviteLink({
            email: profile.email,
            firstName: profile.first_name ?? recipientName.split(' ')[0] ?? 'Member',
            lastName: profile.last_name ?? recipientName.split(' ').slice(1).join(' ') ?? '',
            redirectTo: inviteRedirect,
          });
          invitesSent += 1;
        }

        const emailResult = await sendTournamentOnboardEmail({
          to: profile.email,
          recipientName,
          tournamentName: tournament.name,
          tournamentDates,
          teamName: team.team_name,
          teamSideLabel,
          rosterNames,
          tournamentUrl: profile.invite_status === 'pending' ? inviteRedirect : tournamentUrl,
          isPendingMember: profile.invite_status === 'pending',
        });

        if (emailResult.sent) {
          emailed += 1;
        } else if (emailResult.error) {
          errors.push(`${profile.email}: ${emailResult.error}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Email failed';
        errors.push(`${profile.email}: ${message}`);
      }
    }

    const now = new Date().toISOString();
    const patchResult = await adminFetch<TeamRow[]>(`/rest/v1/tournament_teams?id=eq.${teamId}`, {
      method: 'PATCH',
      body: {
        roster_status: 'ready',
        roster_ready_at: now,
        roster_ready_by: authUser.id,
        onboard_email_sent_at: now,
      },
      prefer: 'return=representation',
    });

    if (!patchResult.ok) {
      return c.json({ error: 'Roster was updated in email step but status save failed' }, 500);
    }

    return c.json({
      emailed,
      invitesSent,
      skippedGuests,
      errors,
    });
  }
);

export { tournamentTeamsRouter };
