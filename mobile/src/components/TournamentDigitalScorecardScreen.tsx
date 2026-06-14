import { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Save } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { TournamentScorecardGrid } from '@/components/TournamentScorecardGrid';
import { useMemberAuthStore } from '@/lib/member-auth-store';
import { getMembersForChallenge } from '@/lib/social-service';
import {
  getTeamsForPlayer,
  getTournamentById,
  getTournamentTeams,
} from '@/lib/tournament-service';
import { getTournamentMatchGroups } from '@/lib/tournament-match-service';
import {
  buildTournamentPlayerMaps,
  getTournamentPlayers,
  resolveRosterEntries,
} from '@/lib/tournament-player-service';
import { formatRoundPickerLabel, getMatchGroupFormat, getRoundFormat } from '@/lib/tournament-labels';
import { flattenRoundFormats } from '@/lib/tournament-schedule';
import {
  useTournamentStore,
  useTournamentIsDirty,
} from '@/lib/tournament-store';
import type { TournamentTeamSide } from '@/types';
import { cn } from '@/lib/cn';

export function TournamentDigitalScorecardScreen() {
  const { id, matchGroupId, round, side } = useLocalSearchParams<{
    id: string;
    matchGroupId?: string;
    round?: string;
    side?: TournamentTeamSide;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useMemberAuthStore((s) => s.user);
  const profile = useMemberAuthStore((s) => s.profile);

  const initSession = useTournamentStore((s) => s.initSession);
  const switchRound = useTournamentStore((s) => s.switchRound);
  const setRoundNumber = useTournamentStore((s) => s.setRoundNumber);
  const setCurrentHole = useTournamentStore((s) => s.setCurrentHole);
  const setPlayerGross = useTournamentStore((s) => s.setPlayerGross);
  const setTeamGross = useTournamentStore((s) => s.setTeamGross);
  const loadExistingScores = useTournamentStore((s) => s.loadExistingScores);
  const restoreSession = useTournamentStore((s) => s.restoreSession);
  const syncScoresToSupabase = useTournamentStore((s) => s.syncScoresToSupabase);
  const getComputedHoleScores = useTournamentStore((s) => s.getComputedHoleScores);
  const getTotals = useTournamentStore((s) => s.getTotals);
  const getPlayerHoleDetails = useTournamentStore((s) => s.getPlayerHoleDetails);

  const roundFormats = useTournamentStore((s) => s.roundFormats);
  const format = useTournamentStore((s) => s.format);
  const roundNumber = useTournamentStore((s) => s.roundNumber);
  const currentHole = useTournamentStore((s) => s.currentHole);
  const players = useTournamentStore((s) => s.players);
  const grossScores = useTournamentStore((s) => s.grossScores);
  const teamGrossScores = useTournamentStore((s) => s.teamGrossScores);
  const isSyncing = useTournamentStore((s) => s.isSyncing);
  const isDirty = useTournamentIsDirty();

  const { data: tournament } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => getTournamentById(id!),
    enabled: Boolean(id),
  });

  const { data: myTeams = [] } = useQuery({
    queryKey: ['myTeams', id, user?.id],
    queryFn: () => getTeamsForPlayer(id!, user!.id),
    enabled: Boolean(id && user?.id),
  });

  const { data: allTeams = [] } = useQuery({
    queryKey: ['tournamentTeams', id],
    queryFn: () => getTournamentTeams(id!),
    enabled: Boolean(id),
  });

  const initialRound = round ? Number(round) : 1;

  const { data: matchGroups = [] } = useQuery({
    queryKey: ['tournamentMatchGroups', id],
    queryFn: () => getTournamentMatchGroups(id!),
    enabled: Boolean(id && matchGroupId),
  });

  const activeMatchGroup = matchGroups.find((g) => g.id === matchGroupId) ?? null;
  const matchRoundNumber = activeMatchGroup?.round_number ?? initialRound;

  const { data: members = [] } = useQuery({
    queryKey: ['membersForTeam'],
    queryFn: getMembersForChallenge,
  });

  const { data: tournamentPlayers = [] } = useQuery({
    queryKey: ['tournamentPlayers', id],
    queryFn: () => getTournamentPlayers(id!),
    enabled: Boolean(id),
  });

  const { nameById: playerNameById, handicapById: playerHandicapById } = useMemo(
    () => buildTournamentPlayerMaps(tournamentPlayers, members),
    [tournamentPlayers, members]
  );

  const selectedTeam = myTeams[0] ?? allTeams[0] ?? null;

  const buildPlayersForRound = (
    roundFormat: ReturnType<typeof getRoundFormat>,
    roundNum: number,
    group: typeof activeMatchGroup = null
  ) => {
    if (group && group.round_number === roundNum) {
      const playerIds =
        side === 'side_b'
          ? group.side_b_player_ids
          : side === 'side_a'
            ? group.side_a_player_ids
            : roundFormat === 'singles'
              ? [...group.side_a_player_ids, ...group.side_b_player_ids]
              : [];

      if (roundFormat !== 'singles' && !side) return null;

      const teamId =
        side === 'side_b'
          ? group.side_b_team_id
          : side === 'side_a'
            ? group.side_a_team_id
            : null;

      const teamName =
        allTeams.find((t) => t.id === teamId)?.team_name ??
        (side === 'side_a' ? 'Team A' : side === 'side_b' ? 'Team B' : null);

      return {
        teamId: roundFormat === 'singles' ? null : teamId,
        teamName,
        userId: null as string | null,
        matchGroupId: group.id,
        roundNumber: roundNum,
        players: playerIds.map((pid) => ({
          id: pid,
          name: playerNameById[pid] ?? 'Player',
          handicapIndex: playerHandicapById[pid] ?? 0,
          tournamentPlayerId: tournamentPlayers.some((p) => p.id === pid) ? pid : null,
        })),
      };
    }

    if (roundFormat === 'singles' && user?.id) {
      return {
        teamId: null as string | null,
        teamName: null as string | null,
        userId: user.id,
        matchGroupId: null as string | null,
        roundNumber: roundNum,
        players: [
          {
            id: user.id,
            name: profile?.full_name ?? 'Player',
            handicapIndex: profile?.handicap_index ?? 0,
          },
        ],
      };
    }

    if (!selectedTeam) return null;

    return {
      teamId: selectedTeam.id,
      teamName: selectedTeam.team_name,
      userId: null as string | null,
      matchGroupId: null as string | null,
      roundNumber: roundNum,
      players: resolveRosterEntries(selectedTeam.player_ids, tournamentPlayers, members).map(
        (entry) => ({
          id: entry.id,
          name: entry.display_name,
          handicapIndex: entry.handicap_index,
          tournamentPlayerId: entry.id,
        })
      ),
    };
  };

  useEffect(() => {
    if (!id || !tournament) return;
    if (matchGroupId && !activeMatchGroup) return;

    const bootstrap = async () => {
      const restored = await restoreSession(id);
      if (restored) {
        await loadExistingScores();
        return;
      }

      const roundNum = matchRoundNumber;
      const matchFormat = activeMatchGroup
        ? getMatchGroupFormat(activeMatchGroup, tournament)
        : getRoundFormat(tournament, roundNum);
      const context = buildPlayersForRound(matchFormat, roundNum, activeMatchGroup);
      if (!context) return;

      initSession({
        tournamentId: id,
        roundFormats: flattenRoundFormats(tournament.round_schedule),
        roundNumber: roundNum,
        format: matchFormat,
        teamId: context.teamId,
        teamName: context.teamName,
        userId: context.userId,
        matchGroupId: context.matchGroupId,
        players: context.players,
      });

      await loadExistingScores();
    };

    bootstrap();
  }, [id, tournament?.id, selectedTeam?.id, user?.id, activeMatchGroup?.id, matchGroupId]);

  const handleRoundChange = async (nextRound: number) => {
    if (!tournament) return;
    const matchGroupForRound =
      activeMatchGroup?.round_number === nextRound ? activeMatchGroup : null;
    const matchFormat = matchGroupForRound
      ? getMatchGroupFormat(matchGroupForRound, tournament)
      : getRoundFormat(tournament, nextRound);
    const context = buildPlayersForRound(matchFormat, nextRound, matchGroupForRound);
    if (!context) {
      setRoundNumber(nextRound);
      await loadExistingScores();
      return;
    }

    switchRound({
      roundNumber: nextRound,
      format: matchFormat,
      teamId: context.teamId,
      teamName: context.teamName,
      userId: context.userId,
      matchGroupId: context.matchGroupId,
      players: context.players,
    });
    await loadExistingScores();
  };

  const computedScores = useMemo(() => getComputedHoleScores(), [
    grossScores,
    teamGrossScores,
    format,
    players,
  ]);

  const playerDetails = useMemo(() => {
    const map: Record<string, ReturnType<typeof getPlayerHoleDetails>> = {};
    for (const player of players) {
      map[player.id] = getPlayerHoleDetails(player.id);
    }
    return map;
  }, [players, grossScores, format]);

  const totals = getTotals();

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await syncScoresToSupabase();
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await queryClient.invalidateQueries({ queryKey: ['tournamentScores', id] });
      await queryClient.invalidateQueries({ queryKey: ['matchHoleResults'] });
      await queryClient.invalidateQueries({ queryKey: ['tournamentMatchGroups', id] });
      Alert.alert(
        'Saved',
        activeMatchGroup
          ? 'Scores synced. Match hole wins updated automatically.'
          : 'Tournament scores synced to Supabase.'
      );
      router.back();
      return;
    }
    Alert.alert('Save failed', result.error ?? 'Could not sync scores.');
  };

  if (!tournament || !format) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center">
        <ActivityIndicator color="#a3e635" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <View style={{ paddingTop: insets.top }} className="bg-[#141414] border-b border-neutral-800">
        <View className="flex-row items-center px-4 py-3">
          <Pressable onPress={() => router.back()} className="flex-row items-center active:opacity-60">
            <ChevronLeft size={24} color="#a3e635" />
            <Text className="text-lime-400 text-base font-medium ml-1">Back</Text>
          </Pressable>
          <View className="ml-4 flex-1">
            <Text className="text-white text-lg font-semibold">Scorecard</Text>
            <Text className="text-neutral-500 text-xs">
              {formatRoundPickerLabel(tournament, roundNumber)} · {tournament.name}
            </Text>
          </View>
          {isDirty && (
            <View className="bg-amber-900/40 rounded-full px-2 py-1">
              <Text className="text-amber-300 text-[10px] font-semibold">UNSYNCED</Text>
            </View>
          )}
        </View>

        <View className="px-5 pb-4">
          <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">Round</Text>
          <View className="flex-row gap-2">
            {Array.from({ length: tournament.rounds_count }, (_, i) => i + 1).map((n) => (
              <Pressable
                key={n}
                onPress={() => handleRoundChange(n)}
                className={cn(
                  'px-4 py-2 rounded-lg border min-w-[72px] items-center',
                  roundNumber === n
                    ? 'bg-lime-900/40 border-lime-600'
                    : 'bg-[#0c0c0c] border-neutral-800'
                )}
              >
                <Text
                  className={cn(
                    'font-semibold',
                    roundNumber === n ? 'text-lime-400' : 'text-neutral-500'
                  )}
                >
                  {formatRoundPickerLabel(tournament, n)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <TournamentScorecardGrid
          format={format}
          players={players}
          currentHole={currentHole}
          grossScores={grossScores}
          teamGrossScores={teamGrossScores}
          computedScores={computedScores}
          playerDetails={playerDetails}
          onSelectHole={setCurrentHole}
          onPlayerGrossChange={setPlayerGross}
          onTeamGrossChange={setTeamGross}
        />

        <View className="mx-5 mt-4 bg-[#141414] rounded-2xl border border-neutral-800 p-4">
          <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
            Round Totals (Net / Gross)
          </Text>
          <Text className="text-white text-3xl font-bold">
            {totals.total_net}
            <Text className="text-neutral-500 text-lg font-normal"> / {totals.total_gross}</Text>
          </Text>
        </View>
      </ScrollView>

      <View
        style={{ paddingBottom: insets.bottom + 12 }}
        className="absolute bottom-0 left-0 right-0 bg-[#141414] border-t border-neutral-800 px-5 pt-4"
      >
        <Pressable
          onPress={handleSave}
          disabled={isSyncing}
          className="flex-row items-center justify-center bg-lime-600 rounded-xl py-4 active:opacity-80"
        >
          {isSyncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Save size={18} color="#fff" />
              <Text className="text-white font-bold text-base ml-2">Sync to Supabase</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export default TournamentDigitalScorecardScreen;
