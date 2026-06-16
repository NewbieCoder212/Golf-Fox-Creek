import { useQuery } from '@tanstack/react-query';

import { getTournamentFormatsSettings } from '@/lib/supabase';
import { getDefaultTournamentFormatsSettings } from '@/lib/tournament-format-settings';
import type { TournamentFormatsSettings } from '@/types';

export function useTournamentFormatsSettings() {
  return useQuery<TournamentFormatsSettings>({
    queryKey: ['tournamentFormatsSettings'],
    queryFn: getTournamentFormatsSettings,
    staleTime: 1000 * 60 * 5,
    placeholderData: getDefaultTournamentFormatsSettings(),
  });
}
