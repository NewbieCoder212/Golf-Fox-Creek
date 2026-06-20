import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { fetchTournamentDisplayBySlug } from '@/lib/display-service';
import { isDisplayRealtimeConfigured } from '@/hooks/useTournamentDisplayRealtime';
import { TournamentTvDisplayContent } from '@/components/TournamentTvDisplayContent';

const TV_DISPLAY_POLL_MS = isDisplayRealtimeConfigured() ? 60_000 : 30_000;

export default function TournamentTvDisplayBySlugScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const normalizedSlug = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
  const displayEnabled = Boolean(normalizedSlug);

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['tournamentDisplaySlug', normalizedSlug],
    queryFn: () => fetchTournamentDisplayBySlug(normalizedSlug),
    enabled: displayEnabled,
    staleTime: TV_DISPLAY_POLL_MS,
    refetchInterval: TV_DISPLAY_POLL_MS,
  });

  const handleRefetch = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <TournamentTvDisplayContent
      tournamentId={data?.tournament.id}
      data={data}
      isLoading={displayEnabled ? isLoading : false}
      error={error}
      isFetching={isFetching}
      dataUpdatedAt={dataUpdatedAt}
      onRefetch={handleRefetch}
      showInvalidLink={!displayEnabled}
      invalidLinkMessage="Use a short TV link like foxcreek.golf/tv/generation-cup"
    />
  );
}
