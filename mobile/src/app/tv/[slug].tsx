import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { fetchTournamentDisplayBySlug } from '@/lib/display-service';
import { TournamentTvDisplayContent } from '@/components/TournamentTvDisplayContent';

function isLoungeModeParam(mode: string | string[] | undefined): boolean {
  const value = Array.isArray(mode) ? mode[0] : mode;
  return value?.trim().toLowerCase() === 'lounge';
}

export default function TournamentTvDisplayBySlugScreen() {
  const { slug, mode } = useLocalSearchParams<{ slug: string; mode?: string }>();
  const normalizedSlug = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
  const displayEnabled = Boolean(normalizedSlug);
  const loungeMode = isLoungeModeParam(mode);

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
      loungeMode={loungeMode}
    />
  );
}
