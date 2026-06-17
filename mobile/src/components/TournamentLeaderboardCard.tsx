import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Trophy, ChevronRight } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { TournamentTeamMatchupBoard } from '@/components/TournamentTeamMatchupBoard';
import {
  buildMatchPointsLeaderboard,
  getTournamentById,
  getTournamentTeams,
} from '@/lib/tournament-service';
import { getTournamentMatchGroups } from '@/lib/tournament-match-service';
import { formatTournamentDates } from '@/lib/tournament-labels';
import { cn } from '@/lib/cn';
import { useTranslations } from '@/lib/language-store';

interface TournamentLeaderboardCardProps {
  tournamentId: string;
  compact?: boolean;
  hubEmbedded?: boolean;
}

export function TournamentLeaderboardCard({
  tournamentId,
  compact = false,
  hubEmbedded = false,
}: TournamentLeaderboardCardProps) {
  const router = useRouter();
  const t = useTranslations();

  const { data: tournament, isPending: tournamentPending, isError: tournamentError } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => getTournamentById(tournamentId),
    enabled: Boolean(tournamentId),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['tournamentTeams', tournamentId],
    queryFn: () => getTournamentTeams(tournamentId),
    enabled: Boolean(tournamentId),
  });

  const { data: matchGroups = [], isFetching: groupsFetching } = useQuery({
    queryKey: ['tournamentMatchGroups', tournamentId],
    queryFn: () => getTournamentMatchGroups(tournamentId),
    enabled: Boolean(tournamentId),
    refetchInterval: hubEmbedded ? 30_000 : 15_000,
  });

  const standings = buildMatchPointsLeaderboard(teams, matchGroups);
  const teamStats = standings.map((row) => ({
    teamId: row.teamId,
    matchPoints: row.matchPoints,
    matchesWon: row.matchesWon,
  }));
  const isLoading = tournamentPending;

  const openTournament = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (hubEmbedded) {
      router.push(`/tournaments/${tournamentId}?tab=teams`);
      return;
    }
    router.push(`/tournaments/${tournamentId}`);
  };

  if (isLoading) {
    return (
      <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-5 items-center">
        <ActivityIndicator color="#a3e635" />
      </View>
    );
  }

  if (tournamentError || !tournament) {
    return (
      <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-4">
        <Text className="text-neutral-400 text-sm text-center">
          Standings unavailable right now.
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={openTournament}
      className={cn(
        'bg-[#141414] rounded-2xl border border-lime-700/30 overflow-hidden active:opacity-90'
      )}
    >
      {!hubEmbedded ? (
        <View className="px-4 py-3 border-b border-neutral-800 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Trophy size={18} color="#a3e635" />
            <View className="ml-2 flex-1">
              <Text className="text-white font-bold" numberOfLines={1}>
                {tournament.name}
              </Text>
              {!compact && (
                <Text className="text-neutral-500 text-xs mt-0.5">
                  {formatTournamentDates(tournament.start_date, tournament.end_date)}
                </Text>
              )}
            </View>
          </View>
          <ChevronRight size={18} color="#525252" />
        </View>
      ) : null}

      <View className={cn(hubEmbedded ? 'p-2 relative' : 'p-3 relative')}>
        {groupsFetching && hubEmbedded ? (
          <View className="absolute top-2 right-2 z-10">
            <ActivityIndicator size="small" color="#a3e635" />
          </View>
        ) : null}
        <TournamentTeamMatchupBoard
          teams={teams}
          teamStats={teamStats}
          subtitle={hubEmbedded ? undefined : 'Team Matchup'}
          compact={compact}
          minimal={hubEmbedded}
          className="border-0 bg-transparent"
        />
        {standings.length === 0 ? (
          <Text
            className={cn(
              'text-neutral-500 text-sm text-center px-2',
              hubEmbedded ? 'mt-1' : 'mt-2'
            )}
          >
            Teams will appear here once match play begins.
          </Text>
        ) : null}
        {hubEmbedded ? (
          <View className="flex-row items-center justify-center mt-2 pt-2 border-t border-neutral-800/60">
            <Text className="text-lime-400 text-xs font-semibold">{t.viewTeams}</Text>
            <ChevronRight size={14} color="#a3e635" style={{ marginLeft: 2 }} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
