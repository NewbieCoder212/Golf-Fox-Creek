import { SponsorBanner } from '@/components/SponsorBanner';
import { cn } from '@/lib/cn';

interface HubAdBannerProps {
  embedded?: boolean;
}

export function HubAdBanner({ embedded = false }: HubAdBannerProps) {
  return (
    <SponsorBanner
      placementType="member_hub"
      compact={embedded}
      className={cn(embedded ? 'mx-4 mb-2' : 'mx-5 mt-8 mb-8')}
    />
  );
}
