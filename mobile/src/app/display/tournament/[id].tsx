import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { fetchTournamentDisplay } from '@/lib/display-service';
import { isDisplayRealtimeConfigured } from '@/hooks/useTournamentDisplayRealtime';
import { TournamentTvDisplayContent } from '@/components/TournamentTvDisplayContent';

const TV_DISPLAY_POLL_MS = isDisplayRealtimeConfigured() ? 60_000 : 30_000;

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
    staleTime: TV_DISPLAY_POLL_MS,
    refetchInterval: TV_DISPLAY_POLL_MS,
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
