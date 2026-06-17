import { SponsorBanner } from '@/components/SponsorBanner';

interface TournamentDetailAdBannerProps {
  className?: string;
}

export function TournamentDetailAdBanner({ className }: TournamentDetailAdBannerProps) {
  return (
    <SponsorBanner placementType="tournament_detail" variant="auto" className={className} />
  );
}
