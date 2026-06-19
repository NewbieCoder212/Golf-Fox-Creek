import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { fetchTournamentDisplayBySlug } from '@/lib/display-service';
import { TournamentTvDisplayContent } from '@/components/TournamentTvDisplayContent';

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
    staleTime: 10_000,
    refetchInterval: 10_000,
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
