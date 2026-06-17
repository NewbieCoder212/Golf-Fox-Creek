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
    refetchInterval: 15000,
  });

  const standings = buildMatchPointsLeaderboard(teams, matchGroups);
  const teamStats = standings.map((row) => ({
    teamId: row.teamId,
    matchPoints: row.matchPoints,
    matchesWon: row.matchesWon,
  }));
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

      <View className="p-3">
        <TournamentTeamMatchupBoard
          teams={teams}
          teamStats={teamStats}
          subtitle="Team Matchup"
          compact={compact}
          className="border-0 bg-transparent"
        />
        {standings.length === 0 ? (
          <Text className="text-neutral-500 text-sm text-center mt-2 px-2">
            Teams will appear here once match play begins.
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
