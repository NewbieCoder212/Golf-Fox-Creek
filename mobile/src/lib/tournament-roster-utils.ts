import type { TournamentPlayer, TournamentTeam } from '@/types';

export function getTeamRosterStatusLabel(team: TournamentTeam): string {
  const status = team.roster_status ?? 'draft';
  if (status === 'draft') return 'Draft';
  if (team.onboard_email_sent_at) return 'Emailed';
  return 'Ready';
}

export function canCaptainManageRoster(
  team: TournamentTeam,
  userId: string | undefined,
  tournamentPlayers?: Array<Pick<TournamentPlayer, 'id' | 'user_id'>>
): boolean {
  if (!userId || (team.roster_status ?? 'draft') !== 'draft') return false;
  if (team.captain_user_id === userId) return true;
  if (!team.captain_player_id || !tournamentPlayers) return false;
  const captainPlayer = tournamentPlayers.find((player) => player.id === team.captain_player_id);
  return captainPlayer?.user_id === userId;
}

export function canManageTeamRoster(
  team: TournamentTeam,
  options: { isManager: boolean; userId?: string }
): boolean {
  return options.isManager || canCaptainManageRoster(team, options.userId);
}
