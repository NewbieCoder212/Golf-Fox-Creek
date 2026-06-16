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
};

type TeamRow = {
  id: string;
  tournament_id: string;
  team_name: string;
  side: 'side_a' | 'side_b' | null;
  player_ids: string[];
  captain_user_id: string | null;
  roster_status: 'draft' | 'ready';
  onboard_email_sent_at: string | null;
};

type TournamentPlayerRow = {
  id: string;
  display_name: string;
  user_id: string | null;
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

    if (!team.captain_user_id) {
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
    const teamSideLabel = team.side === 'side_b' ? 'Team B' : 'Team A';
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
