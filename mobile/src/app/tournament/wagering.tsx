import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Coins, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  useTournamentStore,
  useTournamentWageringResults,
} from '@/lib/tournament-store';
import {
  createWageringSession,
  getWageringSessionsForTournament,
  refreshWageringResults,
} from '@/lib/wagering-service';
import { getMembersForChallenge } from '@/lib/social-service';
import {
  getTournamentById,
  getTournamentTeams,
} from '@/lib/tournament-service';
import { getPlayingHandicap } from '@/lib/tournament-scoring';
import { flattenRoundFormats } from '@/lib/tournament-schedule';
import { GAME_TYPE_LABELS, getRoundFormat } from '@/lib/tournament-labels';
import type { SkinsResults, StablefordResults, WageringGameType } from '@/types';
import { cn } from '@/lib/cn';

/** Spec route: /tournament/wagering?id=... — The Gambling Den */
export default function TournamentGamblingDenScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [gameType, setGameType] = useState<WageringGameType>('skins');
  const [carryover, setCarryover] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const initSession = useTournamentStore((s) => s.initSession);
  const setWageringLive = useTournamentStore((s) => s.setWageringLive);
  const recalculateWagering = useTournamentStore((s) => s.recalculateWagering);
  const grossScores = useTournamentStore((s) => s.grossScores);
  const storePlayers = useTournamentStore((s) => s.players);
  const liveResults = useTournamentWageringResults();
  const storeFormat = useTournamentStore((s) => s.format);
  const roundNumber = useTournamentStore((s) => s.roundNumber);

  const activeGameType = useTournamentStore((s) => s.wageringGameType);

  const { data: tournament } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => getTournamentById(id!),
    enabled: Boolean(id),
  });

  const roundFormat =
    storeFormat ?? (tournament ? getRoundFormat(tournament, roundNumber) : 'best_ball');

  const { data: teams = [] } = useQuery({
    queryKey: ['tournamentTeams', id],
    queryFn: () => getTournamentTeams(id!),
    enabled: Boolean(id),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['membersForTeam'],
    queryFn: getMembersForChallenge,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['wageringSessions', 'tournament', id],
    queryFn: () => getWageringSessionsForTournament(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!id || !tournament || teams.length === 0) return;
    const team = teams[0];
    initSession({
      tournamentId: id,
      roundFormats: flattenRoundFormats(tournament.round_schedule),
      teamId: team.id,
      teamName: team.team_name,
      players: team.player_ids.map((pid) => {
        const member = members.find((m) => m.id === pid);
        return {
          id: pid,
          name: member?.full_name ?? 'Player',
          handicapIndex: member?.handicap_index ?? 0,
        };
      }),
    });
  }, [id, tournament?.id, teams.length, members.length]);

  useEffect(() => {
    recalculateWagering();
  }, [storePlayers.length]);

  const displayGameType = activeGameType ?? gameType;

  const createMutation = useMutation({
    mutationFn: createWageringSession,
    onSuccess: (session) => {
      if (!session) return;
      queryClient.invalidateQueries({ queryKey: ['wageringSessions', 'tournament', id] });
      setActiveSessionId(session.id);
      setWageringLive({
        sessionId: session.id,
        gameType: session.game_type,
        settings: session.settings,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const playerInputs = useMemo(
    () =>
      storePlayers.map((player) => ({
        playerId: player.id,
        courseHandicap: getPlayingHandicap(player.handicapIndex, roundFormat),
        grossByHole: Object.entries(grossScores[player.id] ?? {}).map(([hole, gross]) => ({
          hole: Number(hole),
          gross,
        })),
      })),
    [storePlayers, grossScores, roundFormat]
  );

  const memberName = (playerId: string) =>
    members.find((m) => m.id === playerId)?.full_name?.split(' ')[0] ?? playerId.slice(0, 6);

  const handleCreate = () => {
    if (!id) return;
    const settings =
      gameType === 'skins'
        ? { carryover, value_per_skin: 5 }
        : {
            point_values: { eagle: 4, birdie: 2, par: 0, bogey: -1, double_bogey: -2, worse: -3 },
          };

    createMutation.mutate({ tournament_id: id, game_type: gameType, settings });
  };

  const handleRefreshRemote = async () => {
    if (!activeSessionId) return;
    await refreshWageringResults(activeSessionId, playerInputs);
    recalculateWagering();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const skinsResults = liveResults as SkinsResults | null;
  const stablefordResults = liveResults as StablefordResults | null;

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <View style={{ paddingTop: insets.top }} className="bg-[#141414] border-b border-neutral-800">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable onPress={() => router.back()} className="flex-row items-center active:opacity-60">
            <ChevronLeft size={24} color="#a3e635" />
            <Text className="text-lime-400 text-base font-medium ml-1">Back</Text>
          </Pressable>
          {activeSessionId && (
            <Pressable
              onPress={handleRefreshRemote}
              className="flex-row items-center bg-neutral-800 rounded-full px-3 py-1.5"
            >
              <RefreshCw size={14} color="#a3e635" />
              <Text className="text-lime-400 text-xs font-medium ml-1">Sync</Text>
            </Pressable>
          )}
        </View>
        <View className="px-5 pb-4">
          <Text className="text-white text-2xl font-bold">The Gambling Den</Text>
          <Text className="text-neutral-400 text-sm mt-1">
            Live Skins & Stableford · {tournament?.name ?? 'Tournament'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View className="mx-5 mt-4 bg-[#141414] rounded-2xl border border-neutral-800 p-4">
          <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">
            Start Side Game
          </Text>
          <View className="flex-row gap-2 mb-4">
            {(['skins', 'stableford_points'] as WageringGameType[]).map((type) => (
              <Pressable
                key={type}
                onPress={() => setGameType(type)}
                className={cn(
                  'flex-1 py-3 rounded-xl border items-center',
                  gameType === type
                    ? 'bg-lime-900/40 border-lime-600'
                    : 'bg-[#0c0c0c] border-neutral-800'
                )}
              >
                <Text
                  className={cn(
                    'text-sm font-semibold',
                    gameType === type ? 'text-lime-400' : 'text-neutral-500'
                  )}
                >
                  {GAME_TYPE_LABELS[type]}
                </Text>
              </Pressable>
            ))}
          </View>
          {gameType === 'skins' && (
            <View className="flex-row items-center justify-between mb-4 bg-[#0c0c0c] rounded-xl px-4 py-3 border border-neutral-800">
              <Text className="text-white font-medium">Carryover on ties</Text>
              <Switch
                value={carryover}
                onValueChange={setCarryover}
                trackColor={{ false: '#404040', true: '#4d7c0f' }}
                thumbColor={carryover ? '#a3e635' : '#737373'}
              />
            </View>
          )}
          <Pressable
            onPress={handleCreate}
            disabled={createMutation.isPending}
            className="bg-lime-600 rounded-xl py-3.5 items-center active:opacity-80"
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold">Start Live Game</Text>
            )}
          </Pressable>
        </View>

        {liveResults && displayGameType === 'skins' && skinsResults?.balances && (
          <View className="mx-5 mt-4">
            <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">
              Live Skins Balances
            </Text>
            <View className="bg-[#141414] rounded-2xl border border-neutral-800 overflow-hidden">
              {Object.entries(skinsResults.balances).map(([playerId, balance], index) => (
                <View
                  key={playerId}
                  className={cn(
                    'flex-row items-center justify-between px-4 py-3',
                    index > 0 && 'border-t border-neutral-800'
                  )}
                >
                  <View className="flex-row items-center">
                    <Coins size={16} color="#a3e635" />
                    <Text className="text-white font-medium ml-2">{memberName(playerId)}</Text>
                  </View>
                  <Text className="text-lime-400 font-bold text-lg">
                    {balance > 0 ? '+' : ''}
                    {balance}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {liveResults && displayGameType === 'stableford_points' && stablefordResults?.totals && (
          <View className="mx-5 mt-4">
            <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">
              Live Stableford Points
            </Text>
            <View className="bg-[#141414] rounded-2xl border border-neutral-800 overflow-hidden">
              {Object.entries(stablefordResults.totals).map(([playerId, total], index) => (
                <View
                  key={playerId}
                  className={cn(
                    'flex-row items-center justify-between px-4 py-3',
                    index > 0 && 'border-t border-neutral-800'
                  )}
                >
                  <Text className="text-white font-medium">{memberName(playerId)}</Text>
                  <Text className="text-lime-400 font-bold text-lg">{total}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {sessions.length > 0 && (
          <Text className="text-neutral-500 text-xs uppercase tracking-widest mx-5 mt-6 mb-3">
            Saved Sessions
          </Text>
        )}
        {sessions.map((session) => (
          <Pressable
            key={session.id}
            onPress={() => router.push(`/wagering/${session.id}`)}
            className="mx-5 mb-2 bg-[#141414] border border-neutral-800 rounded-xl p-4 active:opacity-80"
          >
            <Text className="text-white font-semibold">{GAME_TYPE_LABELS[session.game_type]}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
