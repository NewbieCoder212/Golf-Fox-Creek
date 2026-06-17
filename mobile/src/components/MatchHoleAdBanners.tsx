import { View } from 'react-native';

import { SponsorBanner } from '@/components/SponsorBanner';

interface MatchHoleAdBannersProps {
  holeNumber: number;
  className?: string;
}

export function MatchHoleAdBanners({ holeNumber, className }: MatchHoleAdBannersProps) {
  return (
    <View className={className}>
      <SponsorBanner
        placementType="hole_sponsor"
        holeNumber={holeNumber}
        variant="auto"
        className="mb-2"
      />
      <SponsorBanner
        placementType="hole_sponsor_secondary"
        holeNumber={holeNumber}
        variant="auto"
      />
    </View>
  );
}
