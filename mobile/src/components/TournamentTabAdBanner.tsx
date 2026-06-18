import { SponsorBanner, useAdPlacement } from '@/components/SponsorBanner';
import { pickTournamentEventHeaderAds } from '@/lib/ad-placement-service';
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
  const placementType = TAB_PLACEMENT[tab];
  const { data: ads = [] } = useAdPlacement(placementType);
  const { ads: headerAds, variant } = pickTournamentEventHeaderAds(ads);

  if (headerAds.length === 0) {
    return null;
  }

  return (
    <SponsorBanner
      ads={headerAds}
      placementType={placementType}
      variant={variant}
      className={className}
    />
  );
}

export function tournamentTabPlacementType(tab: TournamentEventTab): AdPlacementType {
  return TAB_PLACEMENT[tab];
}
