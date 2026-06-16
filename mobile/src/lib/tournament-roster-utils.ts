import type { TournamentTeam } from '@/types';

export function getTeamRosterStatusLabel(team: TournamentTeam): string {
  const status = team.roster_status ?? 'draft';
  if (status === 'draft') return 'Draft';
  if (team.onboard_email_sent_at) return 'Emailed';
  return 'Ready';
}

export function canCaptainManageRoster(team: TournamentTeam, userId: string | undefined): boolean {
  return Boolean(
    userId &&
      team.captain_user_id === userId &&
      (team.roster_status ?? 'draft') === 'draft'
  );
}

export function canManageTeamRoster(
  team: TournamentTeam,
  options: { isManager: boolean; userId?: string }
): boolean {
  return options.isManager || canCaptainManageRoster(team, options.userId);
}
