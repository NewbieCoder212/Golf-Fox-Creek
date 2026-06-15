import { useEffect } from 'react';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function isDisplayRealtimeConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Subscribe to live score + match updates for a tournament TV display.
 */
export function useTournamentDisplayRealtime(
  tournamentId: string | undefined,
  onUpdate: () => void
): void {
  useEffect(() => {
    if (!tournamentId || !isDisplayRealtimeConfigured()) return;

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let channel: RealtimeChannel | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onUpdate(), 400);
    };

    channel = client
      .channel(`tv-display-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_scores',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_match_groups',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_match_hole_results',
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) client.removeChannel(channel);
    };
  }, [tournamentId, onUpdate]);
}
