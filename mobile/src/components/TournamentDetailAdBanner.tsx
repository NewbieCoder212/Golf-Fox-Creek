import { SponsorBanner, useAdPlacement } from '@/components/SponsorBanner';
import { pickTournamentEventHeaderAds } from '@/lib/ad-placement-service';

interface TournamentDetailAdBannerProps {
  className?: string;
}

export function TournamentDetailAdBanner({ className }: TournamentDetailAdBannerProps) {
  const { data: ads = [] } = useAdPlacement('tournament_detail');
  const { ads: headerAds, variant } = pickTournamentEventHeaderAds(ads);

  if (headerAds.length === 0) {
    return null;
  }

  return (
    <SponsorBanner
      ads={headerAds}
      placementType="tournament_detail"
      variant={variant}
      className={className}
    />
  );
}
