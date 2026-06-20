import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { fetchTournamentDisplay } from '@/lib/display-service';
import { TournamentTvDisplayContent } from '@/components/TournamentTvDisplayContent';

export default function TournamentTvDisplayByIdScreen() {
  const { id, token } = useLocalSearchParams<{ id: string; token?: string }>();
  const displayEnabled = Boolean(id && token);

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['tournamentDisplay', id, token],
    queryFn: () => fetchTournamentDisplay(id!, token!),
    enabled: displayEnabled,
    staleTime: 10_000,
    refetchInterval: 10_000,
  });

  const handleRefetch = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <TournamentTvDisplayContent
      tournamentId={id}
      data={data}
      isLoading={displayEnabled ? isLoading : false}
      error={error}
      isFetching={isFetching}
      dataUpdatedAt={dataUpdatedAt}
      onRefetch={handleRefetch}
      showInvalidLink={!token}
      invalidLinkMessage="Ask the pro shop for the full TV display URL including the access token."
    />
  );
}
