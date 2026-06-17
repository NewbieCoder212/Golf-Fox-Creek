import { useQuery } from '@tanstack/react-query';

import { getTournamentMatchGroups } from '@/lib/tournament-match-service';

export function tournamentMatchGroupsQueryKey(tournamentId: string | undefined | null) {
  return ['tournamentMatchGroups', tournamentId] as const;
}

/**
 * Canonical React Query hook for tournament_match_groups.
 * Throws on load failure so isError is set — never silently returns [] on permission errors.
 */
export function useTournamentMatchGroupsQuery(
  tournamentId: string | undefined | null,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: tournamentMatchGroupsQueryKey(tournamentId),
    queryFn: () => getTournamentMatchGroups(tournamentId!),
    enabled: Boolean(tournamentId) && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval,
  });
}
