import { SponsorBanner } from '@/components/SponsorBanner';
import type { AdPlacementType } from '@/types';

export type TournamentEventTab = 'schedule' | 'match' | 'teams';

const TAB_PLACEMENT: Record<TournamentEventTab, AdPlacementType> = {
  schedule: 'tournament_tab_schedule',
  match: 'tournament_tab_match',
  teams: 'tournament_tab_teams',
};

interface TournamentTabAdBannerProps {
  tab: TournamentEventTab;
  className?: string;
}

export function TournamentTabAdBanner({ tab, className }: TournamentTabAdBannerProps) {
  return (
    <SponsorBanner placementType={TAB_PLACEMENT[tab]} variant="auto" className={className} />
  );
}

export function tournamentTabPlacementType(tab: TournamentEventTab): AdPlacementType {
  return TAB_PLACEMENT[tab];
}
