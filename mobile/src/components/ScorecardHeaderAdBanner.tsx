import { SponsorBanner, useAdPlacement } from '@/components/SponsorBanner';
import { pickScorecardHeaderAds } from '@/lib/ad-placement-service';

interface ScorecardHeaderAdBannerProps {
  className?: string;
}

export function ScorecardHeaderAdBanner({ className }: ScorecardHeaderAdBannerProps) {
  const { data: ads = [] } = useAdPlacement('scorecard_header');
  const { ads: headerAds, variant } = pickScorecardHeaderAds(ads);

  if (headerAds.length === 0) {
    return null;
  }

  return (
    <SponsorBanner
      ads={headerAds}
      placementType="scorecard_header"
      variant={variant}
      className={className}
    />
  );
}
