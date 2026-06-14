import { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, RefreshCw, Trophy, Target } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  getWageringSessionById,
  refreshWageringResults,
} from '@/lib/wagering-service';
import { getTournamentScores, getTournamentTeams } from '@/lib/tournament-service';
import { getMembersForChallenge } from '@/lib/social-service';
import { getCourseHandicapFromIndex } from '@/lib/tournament-scoring';
import { GAME_TYPE_LABELS } from '@/lib/tournament-labels';
import type { SkinsResults, StablefordResults } from '@/types';
import { cn } from '@/lib/cn';

export default function WageringSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: session, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['wageringSession', sessionId],
    queryFn: () => getWageringSessionById(sessionId!),
    enabled: Boolean(sessionId),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['tournamentTeams', session?.tournament_id],
    queryFn: () => getTournamentTeams(session!.tournament_id!),
    enabled: Boolean(session?.tournament_id),
  });

  const { data: scores = [] } = useQuery({
    queryKey: ['tournamentScores', session?.tournament_id],
    queryFn: () => getTournamentScores(session!.tournament_id!),
    enabled: Boolean(session?.tournament_id),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['membersForTeam'],
    queryFn: getMembersForChallenge,
  });

  const playerInputs = useMemo(() => {
    const playerIds = teams.flatMap((t) => t.player_ids);
    const uniqueIds = [...new Set(playerIds)];

    if (uniqueIds.length === 0) {
      return members.slice(0, 4).map((m) => ({
        playerId: m.id,
        courseHandicap: getCourseHandicapFromIndex(m.handicap_index ?? 0),
        grossByHole: Array.from({ length: 18 }, (_, i) => ({
          hole: i + 1,
          gross: 4 + (i % 3),
        })),
      }));
    }

    return uniqueIds.map((playerId) => {
      const member = members.find((m) => m.id === playerId);
      const singlesScore = scores.find((s) => s.user_id === playerId);
      const teamScore = scores.find((s) =>
        teams.some((t) => t.id === s.team_id && t.player_ids.includes(playerId))
      );
      const holeScores = singlesScore?.hole_scores ?? teamScore?.hole_scores ?? [];

      return {
        playerId,
        courseHandicap: getCourseHandicapFromIndex(member?.handicap_index ?? 0),
        grossByHole: holeScores.map((h) => ({ hole: h.hole, gross: h.gross })),
      };
    });
  }, [teams, scores, members]);

  const refreshMutation = useMutation({
    mutationFn: () => refreshWageringResults(sessionId!, playerInputs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wageringSession', sessionId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.full_name?.split(' ')[0] ?? id.slice(0, 6);

  if (isLoading || !session) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center">
        <ActivityIndicator size="large" color="#a3e635" />
      </View>
    );
  }

  const skinsResults = session.results as SkinsResults;
  const stablefordResults = session.results as StablefordResults;

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <View style={{ paddingTop: insets.top }} className="bg-[#141414] border-b border-neutral-800">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable onPress={() => router.back()} className="flex-row items-center active:opacity-60">
            <ChevronLeft size={24} color="#a3e635" />
            <Text className="text-lime-400 text-base font-medium ml-1">Back</Text>
          </Pressable>
          <Pressable
            onPress={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="flex-row items-center bg-neutral-800 rounded-full px-3 py-1.5 active:opacity-80"
          >
            {refreshMutation.isPending ? (
              <ActivityIndicator size="small" color="#a3e635" />
            ) : (
              <>
                <RefreshCw size={14} color="#a3e635" />
                <Text className="text-lime-400 text-sm font-medium ml-1.5">Refresh</Text>
              </>
            )}
          </Pressable>
        </View>
        <View className="px-5 pb-4">
          <Text className="text-white text-2xl font-bold">{GAME_TYPE_LABELS[session.game_type]}</Text>
          <Text className="text-neutral-400 text-sm mt-1">Live side game results</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#a3e635" />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {session.game_type === 'skins' ? (
          <>
            <Text className="text-neutral-500 text-xs uppercase tracking-widest mx-5 mt-4 mb-3">
              Balances
            </Text>
            <View className="mx-5 bg-[#141414] rounded-2xl border border-neutral-800 overflow-hidden">
              {Object.entries(skinsResults.balances ?? {}).map(([playerId, balance], index) => (
                <View
                  key={playerId}
                  className={cn(
                    'flex-row items-center justify-between px-4 py-3',
                    index > 0 && 'border-t border-neutral-800'
                  )}
                >
                  <View className="flex-row items-center">
                    <Trophy size={16} color={balance > 0 ? '#facc15' : '#737373'} />
                    <Text className="text-white font-medium ml-2">{memberName(playerId)}</Text>
                  </View>
                  <Text
                    className={cn(
                      'font-bold text-lg',
                      balance > 0 ? 'text-lime-400' : balance < 0 ? 'text-red-400' : 'text-neutral-400'
                    )}
                  >
                    {balance > 0 ? '+' : ''}
                    {balance}
                  </Text>
                </View>
              ))}
              {Object.keys(skinsResults.balances ?? {}).length === 0 && (
                <Text className="text-neutral-500 text-center py-6">
                  Tap Refresh to calculate from tournament scores
                </Text>
              )}
            </View>

            <Text className="text-neutral-500 text-xs uppercase tracking-widest mx-5 mt-6 mb-3">
              Hole-by-Hole
            </Text>
            {(skinsResults.holes ?? []).slice(0, 9).map((hole) => (
              <View
                key={hole.hole}
                className="mx-5 mb-2 flex-row items-center bg-[#141414] border border-neutral-800 rounded-xl px-4 py-3"
              >
                <Text className="text-white font-bold w-10">#{hole.hole}</Text>
                <Text className="text-neutral-400 flex-1 text-sm">
                  {hole.winner_ids.length === 1
                    ? `${memberName(hole.winner_ids[0])} wins`
                    : hole.carryover > 0
                      ? `Tie — ${hole.carryover} carried`
                      : 'Tie'}
                </Text>
                {hole.skin_value > 0 && (
                  <Text className="text-lime-400 font-semibold">+{hole.skin_value}</Text>
                )}
              </View>
            ))}
          </>
        ) : (
          <>
            <Text className="text-neutral-500 text-xs uppercase tracking-widest mx-5 mt-4 mb-3">
              Point Totals
            </Text>
            <View className="mx-5 bg-[#141414] rounded-2xl border border-neutral-800 overflow-hidden">
              {Object.entries(stablefordResults.totals ?? {}).map(([playerId, total], index) => (
                <View
                  key={playerId}
                  className={cn(
                    'flex-row items-center justify-between px-4 py-3',
                    index > 0 && 'border-t border-neutral-800'
                  )}
                >
                  <View className="flex-row items-center">
                    <Target size={16} color="#a3e635" />
                    <Text className="text-white font-medium ml-2">{memberName(playerId)}</Text>
                  </View>
                  <Text className="text-lime-400 font-bold text-lg">{total}</Text>
                </View>
              ))}
              {Object.keys(stablefordResults.totals ?? {}).length === 0 && (
                <Text className="text-neutral-500 text-center py-6">
                  Tap Refresh to calculate Stableford points
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
