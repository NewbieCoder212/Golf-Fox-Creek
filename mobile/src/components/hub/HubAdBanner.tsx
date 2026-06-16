import { SponsorBanner, useAdPlacement } from '@/components/SponsorBanner';
import { HubSection } from '@/components/ui/HubSection';
import { isBannerLayout } from '@/lib/ad-placement-service';

interface HubAdBannerProps {
  embedded?: boolean;
}

export function HubAdBanner({ embedded = false }: HubAdBannerProps) {
  const { data: ads = [] } = useAdPlacement('member_hub');
  const bannerAds = ads.filter(isBannerLayout);

  if (bannerAds.length === 0) {
    return null;
  }

  return (
    <SponsorBanner
      ads={bannerAds}
      placementType="member_hub"
      variant="footer"
      className={embedded ? 'mx-5 mb-1' : 'mx-5 mt-8 mb-8'}
    />
  );
}

export function HubAdFeedCards() {
  const { data: ads = [] } = useAdPlacement('member_hub');
  const cardAds = ads.filter((ad) => !isBannerLayout(ad));

  if (cardAds.length === 0) {
    return null;
  }

  return (
    <HubSection title="Sponsored">
      <SponsorBanner
        ads={cardAds}
        placementType="member_hub"
        variant="card"
        className="mb-3"
      />
    </HubSection>
  );
}
