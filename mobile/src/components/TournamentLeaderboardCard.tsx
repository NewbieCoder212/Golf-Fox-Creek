import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Trophy, ChevronRight } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import {
  buildMatchPointsLeaderboard,
  getTournamentById,
  getTournamentTeams,
} from '@/lib/tournament-service';
import { getTournamentMatchGroups } from '@/lib/tournament-match-service';
import { formatTournamentDates } from '@/lib/tournament-labels';
import { cn } from '@/lib/cn';

interface TournamentLeaderboardCardProps {
  tournamentId: string;
  compact?: boolean;
}

export function TournamentLeaderboardCard({
  tournamentId,
  compact = false,
}: TournamentLeaderboardCardProps) {
  const router = useRouter();

  const { data: tournament, isLoading: tournamentLoading } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => getTournamentById(tournamentId),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['tournamentTeams', tournamentId],
    queryFn: () => getTournamentTeams(tournamentId),
    enabled: Boolean(tournamentId),
  });

  const { data: matchGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['tournamentMatchGroups', tournamentId],
    queryFn: () => getTournamentMatchGroups(tournamentId),
    enabled: Boolean(tournamentId),
  });

  const standings = buildMatchPointsLeaderboard(teams, matchGroups);
  const hasPoints = standings.some((row) => row.matchPoints > 0);
  const isLoading = tournamentLoading || groupsLoading;

  const openTournament = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/tournaments/${tournamentId}`);
  };

  if (isLoading) {
    return (
      <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-5 items-center">
        <ActivityIndicator color="#a3e635" />
      </View>
    );
  }

  if (!tournament) return null;

  return (
    <Pressable
      onPress={openTournament}
      className="bg-[#141414] rounded-2xl border border-lime-700/30 overflow-hidden active:opacity-90"
    >
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

      <View className="px-4 py-3">
        <Text className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2">
          Match Points Leaderboard
        </Text>

        {!hasPoints ? (
          <Text className="text-neutral-500 text-sm">
            No match results yet — scores will update standings automatically.
          </Text>
        ) : (
          standings.slice(0, compact ? 2 : 4).map((row, index) => (
            <View
              key={row.teamId}
              className={cn(
                'flex-row items-center py-2',
                index > 0 && 'border-t border-neutral-800/80'
              )}
            >
              <View
                className={cn(
                  'w-7 h-7 rounded-full items-center justify-center mr-3',
                  index === 0 ? 'bg-yellow-500/20' : 'bg-neutral-800'
                )}
              >
                <Text
                  className={cn(
                    'text-xs font-bold',
                    index === 0 ? 'text-yellow-400' : 'text-neutral-400'
                  )}
                >
                  {index + 1}
                </Text>
              </View>
              <Text className="text-white font-medium flex-1">{row.teamName}</Text>
              <View className="items-end">
                <Text className="text-lime-400 font-bold text-lg">{row.matchPoints}</Text>
                <Text className="text-neutral-600 text-[10px]">
                  {row.matchesWon}W / {row.matchesPlayed} played
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </Pressable>
  );
}
