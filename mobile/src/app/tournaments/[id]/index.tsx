import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Trophy,
  Users,
  ClipboardList,
  Coins,
  Plus,
  X,
  Medal,
  Clock,
  Swords,
  UserPlus,
  Trash2,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useMemberAuthStore } from '@/lib/member-auth-store';
import { useAdminAuthStore } from '@/lib/admin-auth-store';
import {
  buildTournamentLeaderboard,
  getTeamsForPlayer,
  getTournamentById,
  getTournamentScores,
  getTournamentTeams,
  isUserRegisteredForTournament,
} from '@/lib/tournament-service';
import { getMembersForChallenge } from '@/lib/social-service';
import { FORMAT_LABELS, formatTournamentDates, tournamentHasSinglesRound, tournamentNeedsTeams } from '@/lib/tournament-labels';
import { TournamentTeeTimesTab } from '@/components/TournamentTeeTimesTab';
import { TournamentMatchGroupsTab } from '@/components/TournamentMatchGroupsTab';
import { getTeamBySide, getMatchHoleResultsForTournament } from '@/lib/tournament-match-service';
import { aggregateEventHoleWins } from '@/lib/tournament-match-scoring';
import {
  appendPlayersToTeam,
  buildTournamentPlayerMaps,
  createTournamentTeamWithRoster,
  getTournamentPlayers,
  removePlayerFromTeam,
  resolveRosterEntries,
} from '@/lib/tournament-player-service';
import { requireData } from '@/lib/tournament-supabase';
import type { TournamentTeam, TournamentTeamSide } from '@/types';
import {
  useTournamentLeaderboardMode,
  useTournamentStore,
} from '@/lib/tournament-store';
import { cn } from '@/lib/cn';

type DetailTab = 'leaderboard' | 'teams' | 'matches' | 'teeTimes';

interface RosterDraftEntry {
  key: string;
  display_name: string;
  handicap_index: number;
  user_id?: string | null;
}

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useMemberAuthStore((s) => s.user);
  const profile = useMemberAuthStore((s) => s.profile);
  const canAccessAdmin = useAdminAuthStore((s) => s.canAccessAdmin);
  const isManager =
    profile?.role === 'manager' ||
    profile?.role === 'super_admin' ||
    canAccessAdmin();
  const viewAllTournaments = isManager;

  const [tab, setTab] = useState<DetailTab>('leaderboard');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TournamentTeam | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamSide, setTeamSide] = useState<TournamentTeamSide>('side_a');
  const [rosterDraft, setRosterDraft] = useState<RosterDraftEntry[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerHandicap, setNewPlayerHandicap] = useState('');

  const { data: tournament, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => getTournamentById(id!),
    enabled: Boolean(id),
  });

  const { data: hasAccess = viewAllTournaments, isLoading: isCheckingAccess } = useQuery({
    queryKey: ['tournamentAccess', id, user?.id, viewAllTournaments],
    queryFn: async () => {
      if (viewAllTournaments || !user?.id || !id) return true;
      return isUserRegisteredForTournament(user.id, id);
    },
    enabled: Boolean(id && user?.id),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['tournamentTeams', id],
    queryFn: () => getTournamentTeams(id!),
    enabled: Boolean(id),
  });

  const sideATeam = getTeamBySide(teams, 'side_a');
  const sideBTeam = getTeamBySide(teams, 'side_b');
  const canAddTeam = !sideATeam || !sideBTeam;

  const { data: scores = [] } = useQuery({
    queryKey: ['tournamentScores', id],
    queryFn: () => getTournamentScores(id!),
    enabled: Boolean(id),
  });

  const { data: myTeams = [] } = useQuery({
    queryKey: ['myTeams', id, user?.id],
    queryFn: () => getTeamsForPlayer(id!, user!.id),
    enabled: Boolean(id && user?.id),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['membersForTeam'],
    queryFn: getMembersForChallenge,
  });

  const { data: tournamentPlayers = [] } = useQuery({
    queryKey: ['tournamentPlayers', id],
    queryFn: () => getTournamentPlayers(id!),
    enabled: Boolean(id),
  });

  const { data: matchHoleResults = [] } = useQuery({
    queryKey: ['matchHoleResults', id],
    queryFn: () => getMatchHoleResultsForTournament(id!),
    enabled: Boolean(id && sideATeam && sideBTeam),
  });

  const eventHoleWins = aggregateEventHoleWins(matchHoleResults);
  const hasMatchResults = matchHoleResults.length > 0;

  const leaderboardMode = useTournamentLeaderboardMode();
  const setLeaderboardMode = useTournamentStore((s) => s.setLeaderboardMode);

  const createTeamMutation = useMutation({
    mutationFn: (params: {
      team_name: string;
      side: TournamentTeamSide;
      roster: RosterDraftEntry[];
    }) =>
      createTournamentTeamWithRoster({
        tournament_id: id!,
        team_name: params.team_name,
        side: params.side,
        roster: params.roster.map((entry) => ({
          display_name: entry.display_name,
          handicap_index: entry.handicap_index,
          user_id: entry.user_id ?? null,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentTeams', id] });
      queryClient.invalidateQueries({ queryKey: ['tournamentPlayers', id] });
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      closeTeamModal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert('Could not save team', error.message);
    },
  });

  const addPlayerMutation = useMutation({
    mutationFn: async (params: {
      team: TournamentTeam;
      display_name: string;
      handicap_index: number;
      user_id?: string | null;
    }) => {
      const result = await appendPlayersToTeam(params.team, [
        {
          display_name: params.display_name,
          handicap_index: params.handicap_index,
          user_id: params.user_id ?? null,
        },
      ]);
      return requireData(result, 'Could not add player');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentTeams', id] });
      queryClient.invalidateQueries({ queryKey: ['tournamentPlayers', id] });
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setNewPlayerName('');
      setNewPlayerHandicap('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert('Could not add player', error.message);
    },
  });

  const removePlayerMutation = useMutation({
    mutationFn: async (params: { team: TournamentTeam; playerId: string }) => {
      const result = await removePlayerFromTeam(params.team, params.playerId);
      return requireData(result, 'Could not remove player');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentTeams', id] });
      queryClient.invalidateQueries({ queryKey: ['tournamentPlayers', id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert('Could not remove player', error.message);
    },
  });

  const leaderboard = buildTournamentLeaderboard(scores, leaderboardMode);
  const teamNameById = Object.fromEntries(teams.map((t) => [t.id, t.team_name]));
  const { nameById: playerNameById } = buildTournamentPlayerMaps(tournamentPlayers, members);

  const closeTeamModal = () => {
    setShowTeamModal(false);
    setEditingTeam(null);
    setTeamName('');
    setRosterDraft([]);
    setNewPlayerName('');
    setNewPlayerHandicap('');
  };

  const addDraftPlayerByName = () => {
    const name = newPlayerName.trim();
    if (!name) return;
    const handicap = Number(newPlayerHandicap);
    setRosterDraft((prev) => [
      ...prev,
      {
        key: `guest-${Date.now()}-${prev.length}`,
        display_name: name,
        handicap_index: Number.isFinite(handicap) ? handicap : 0,
      },
    ]);
    setNewPlayerName('');
    setNewPlayerHandicap('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const addDraftMember = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;
    if (rosterDraft.some((entry) => entry.user_id === member.id)) return;
    setRosterDraft((prev) => [
      ...prev,
      {
        key: member.id,
        display_name: member.full_name,
        handicap_index: member.handicap_index ?? 0,
        user_id: member.id,
      },
    ]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeDraftPlayer = (key: string) => {
    setRosterDraft((prev) => prev.filter((entry) => entry.key !== key));
  };

  const openTeamModal = () => {
    setEditingTeam(null);
    setTeamSide(sideATeam ? 'side_b' : 'side_a');
    setRosterDraft([]);
    setNewPlayerName('');
    setNewPlayerHandicap('');
    setShowTeamModal(true);
  };

  const openManageRoster = (team: TournamentTeam) => {
    setEditingTeam(team);
    setNewPlayerName('');
    setNewPlayerHandicap('');
    setShowTeamModal(true);
  };

  const activeEditingTeam = editingTeam
    ? teams.find((team) => team.id === editingTeam.id) ?? editingTeam
    : null;
  const editingTeamRoster = activeEditingTeam
    ? resolveRosterEntries(activeEditingTeam.player_ids, tournamentPlayers, members)
    : [];

  const addPlayerToExistingTeam = () => {
    if (!activeEditingTeam) return;
    const name = newPlayerName.trim();
    if (!name) return;
    const handicap = Number(newPlayerHandicap);
    addPlayerMutation.mutate({
      team: activeEditingTeam,
      display_name: name,
      handicap_index: Number.isFinite(handicap) ? handicap : 0,
    });
  };

  const addMemberToExistingTeam = (memberId: string) => {
    if (!activeEditingTeam) return;
    const member = members.find((m) => m.id === memberId);
    if (!member) return;
    const alreadyOnTeam = editingTeamRoster.some((entry) => entry.user_id === member.id);
    if (alreadyOnTeam) return;
    addPlayerMutation.mutate({
      team: activeEditingTeam,
      display_name: member.full_name,
      handicap_index: member.handicap_index ?? 0,
      user_id: member.id,
    });
  };

  const handleCreateTeam = () => {
    if (!teamName.trim() || rosterDraft.length === 0 || !id) return;
    const side: TournamentTeamSide = sideATeam ? 'side_b' : 'side_a';
    createTeamMutation.mutate({
      team_name: teamName.trim(),
      side:
        teamSide === 'side_a' && !sideATeam
          ? 'side_a'
          : teamSide === 'side_b' && !sideBTeam
            ? 'side_b'
            : side,
      roster: rosterDraft,
    });
  };

  const canEnterScores =
    isManager ||
    myTeams.length > 0 ||
    (tournament ? tournamentHasSinglesRound(tournament) : false);

  if (isLoading || isCheckingAccess || !tournament) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center">
        <ActivityIndicator size="large" color="#a3e635" />
      </View>
    );
  }

  if (!hasAccess) {
    return (
      <View className="flex-1 bg-[#0c0c0c]">
        <View style={{ paddingTop: insets.top }} className="px-4 py-3">
          <Pressable onPress={() => router.back()} className="flex-row items-center active:opacity-60">
            <ChevronLeft size={24} color="#a3e635" />
            <Text className="text-lime-400 text-base font-medium ml-1">Back</Text>
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Trophy size={48} color="#525252" />
          <Text className="text-white text-xl font-bold mt-4 text-center">Not registered</Text>
          <Text className="text-neutral-400 text-sm text-center mt-2">
            You are not on the roster for {tournament.name}. Contact the pro shop to be added to a
            team.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <View style={{ paddingTop: insets.top }} className="bg-[#141414] border-b border-neutral-800">
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="flex-row items-center active:opacity-60 py-1"
          >
            <ChevronLeft size={24} color="#a3e635" />
            <Text className="text-lime-400 text-base font-medium ml-1">Back</Text>
          </Pressable>
        </View>

        <View className="px-5 pb-4">
          <Text className="text-white text-2xl font-bold">{tournament.name}</Text>
          <Text className="text-neutral-400 text-sm mt-1">
            {formatTournamentDates(tournament.start_date, tournament.end_date)}
          </Text>
          <View className="flex-row flex-wrap gap-2 mt-3">
            {tournament.round_schedule.map((day, dayIndex) => (
              <View
                key={`${tournament.id}-day-${dayIndex}`}
                className="bg-lime-900/30 border border-lime-700/40 rounded-full px-3 py-1"
              >
                <Text className="text-lime-400 text-xs font-semibold">
                  Day {dayIndex + 1}:{' '}
                  {day.formats.map((format) => FORMAT_LABELS[format]).join(', ')}
                </Text>
              </View>
            ))}
            <View className="bg-neutral-800 rounded-full px-3 py-1">
              <Text className="text-neutral-400 text-xs font-medium">
                {tournament.rounds_count} rounds
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mx-5 mb-4"
          contentContainerStyle={{ gap: 8 }}
        >
          {[
            { key: 'leaderboard' as const, label: 'Standings', Icon: Trophy },
            { key: 'teams' as const, label: 'Teams', Icon: Users },
            { key: 'matches' as const, label: 'Matches', Icon: Swords },
            { key: 'teeTimes' as const, label: 'Tee Times', Icon: Clock },
          ].map(({ key, label, Icon }) => (
            <Pressable
              key={key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTab(key);
              }}
              className={cn(
                'px-4 py-2.5 rounded-lg border flex-row items-center gap-1.5',
                tab === key
                  ? 'bg-lime-600 border-lime-600'
                  : 'bg-[#0c0c0c] border-neutral-800'
              )}
            >
              <Icon size={16} color={tab === key ? '#fff' : '#737373'} />
              <Text
                className={cn(
                  'text-xs font-medium',
                  tab === key ? 'text-white' : 'text-neutral-500'
                )}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#a3e635" />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {tab === 'leaderboard' ? (
          <View className="mx-5">
            {hasMatchResults && sideATeam && sideBTeam && (
              <View className="bg-[#141414] rounded-2xl border border-lime-700/40 p-4 mt-2 mb-1">
                <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                  Team Match Play
                </Text>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 items-center">
                    <Text className="text-lime-400 text-xs font-bold uppercase mb-1">
                      {sideATeam.team_name}
                    </Text>
                    <Text className="text-white text-3xl font-bold">{eventHoleWins.side_a}</Text>
                    <Text className="text-neutral-500 text-xs">holes won</Text>
                  </View>
                  <Text className="text-neutral-600 text-lg font-bold px-3">vs</Text>
                  <View className="flex-1 items-center">
                    <Text className="text-lime-400 text-xs font-bold uppercase mb-1">
                      {sideBTeam.team_name}
                    </Text>
                    <Text className="text-white text-3xl font-bold">{eventHoleWins.side_b}</Text>
                    <Text className="text-neutral-500 text-xs">holes won</Text>
                  </View>
                </View>
                {eventHoleWins.ties > 0 && (
                  <Text className="text-neutral-500 text-xs text-center mt-2">
                    {eventHoleWins.ties} holes tied across all matches
                  </Text>
                )}
              </View>
            )}

            <View className="flex-row bg-[#141414] rounded-xl border border-neutral-800 p-1 mt-2 mb-1">
              {(['net', 'gross'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setLeaderboardMode(mode);
                  }}
                  className={cn(
                    'flex-1 py-2 rounded-lg items-center',
                    leaderboardMode === mode && 'bg-lime-600'
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wider',
                      leaderboardMode === mode ? 'text-white' : 'text-neutral-500'
                    )}
                  >
                    {mode === 'net' ? 'Net (Playing Hcp)' : 'Gross'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {leaderboard.length === 0 ? (
              <View className="py-12 items-center bg-[#141414] rounded-2xl border border-neutral-800 mt-2">
                <Medal size={36} color="#525252" />
                <Text className="text-neutral-400 mt-3">No scores submitted yet</Text>
              </View>
            ) : (
              leaderboard.map((entry, index) => (
                <Animated.View
                  key={entry.key}
                  entering={FadeInDown.delay(index * 40).duration(300)}
                  className="flex-row items-center bg-[#141414] border border-neutral-800 rounded-xl p-4 mt-3"
                >
                  <View
                    className={cn(
                      'w-8 h-8 rounded-full items-center justify-center mr-3',
                      index === 0 ? 'bg-yellow-500/20' : 'bg-neutral-800'
                    )}
                  >
                    <Text
                      className={cn(
                        'font-bold text-sm',
                        index === 0 ? 'text-yellow-400' : 'text-neutral-400'
                      )}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold">
                      {teamNameById[entry.key] ?? playerNameById[entry.key] ?? 'Player'}
                    </Text>
                    <Text className="text-neutral-500 text-xs mt-0.5">
                      {entry.rounds_played} round{entry.rounds_played !== 1 ? 's' : ''} played
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-lime-400 font-bold text-lg">
                      {leaderboardMode === 'net' ? entry.total_net : entry.total_gross}
                    </Text>
                    <Text className="text-neutral-500 text-xs">
                      {leaderboardMode === 'net'
                        ? `Net (${entry.total_gross} gross)`
                        : `Gross (${entry.total_net} net)`}
                    </Text>
                  </View>
                </Animated.View>
              ))
            )}
          </View>
        ) : tab === 'teams' ? (
          <View className="mx-5">
            {(isManager || tournamentNeedsTeams(tournament)) && canAddTeam && (
              <Pressable
                onPress={openTeamModal}
                className="flex-row items-center justify-center bg-[#141414] border border-dashed border-neutral-700 rounded-xl py-3 mt-2 active:opacity-80"
              >
                <Plus size={18} color="#a3e635" />
                <Text className="text-lime-400 font-semibold ml-2">
                  Add {sideATeam ? 'Team B' : 'Team A'}
                </Text>
              </Pressable>
            )}

            {teams.map((team, index) => (
              <Animated.View
                key={team.id}
                entering={FadeInDown.delay(index * 50).duration(300)}
                className="bg-[#141414] border border-neutral-800 rounded-xl p-4 mt-3"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-white font-bold text-base">{team.team_name}</Text>
                  {team.side && (
                    <View className="bg-lime-900/30 border border-lime-700/40 rounded-full px-2 py-0.5">
                      <Text className="text-lime-400 text-[10px] font-bold uppercase">
                        {team.side === 'side_a' ? 'Team A' : 'Team B'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-neutral-500 text-xs mt-2 uppercase tracking-widest">
                  Players
                </Text>
                {team.player_ids.map((pid) => (
                  <Text key={pid} className="text-neutral-300 text-sm mt-1">
                    • {playerNameById[pid] ?? 'Player'}
                  </Text>
                ))}
                {isManager && (
                  <Pressable
                    onPress={() => openManageRoster(team)}
                    className="flex-row items-center mt-3 pt-3 border-t border-neutral-800 active:opacity-80"
                  >
                    <UserPlus size={14} color="#a3e635" />
                    <Text className="text-lime-400 font-semibold text-sm ml-2">Manage Players</Text>
                  </Pressable>
                )}
              </Animated.View>
            ))}

            {!tournamentNeedsTeams(tournament) && teams.length === 0 && (
              <Text className="text-neutral-500 text-sm text-center mt-6 px-4">
                All rounds are singles — scores are tracked per member, no teams required.
              </Text>
            )}
          </View>
        ) : tab === 'matches' ? (
          <TournamentMatchGroupsTab
            tournamentId={id!}
            tournament={tournament}
            teams={teams}
            members={members}
            playerNameById={playerNameById}
            isManager={isManager}
          />
        ) : tab === 'teeTimes' ? (
          <TournamentTeeTimesTab
            tournamentId={id!}
            tournament={tournament}
            teams={teams}
            members={members}
            isManager={isManager}
          />
        ) : null}
      </ScrollView>

      <View
        style={{ paddingBottom: insets.bottom + 12 }}
        className="absolute bottom-0 left-0 right-0 bg-[#141414] border-t border-neutral-800 px-5 pt-4"
      >
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => router.push(`/(tabs)/scorecard?id=${id}`)}
            disabled={!canEnterScores}
            className={cn(
              'flex-1 flex-row items-center justify-center rounded-xl py-3.5',
              canEnterScores ? 'bg-lime-600 active:opacity-80' : 'bg-neutral-800 opacity-50'
            )}
          >
            <ClipboardList size={18} color="#fff" />
            <Text className="text-white font-bold ml-2">Enter Scores</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/tournament/wagering?id=${id}`)}
            className="flex-1 flex-row items-center justify-center bg-neutral-800 rounded-xl py-3.5 active:opacity-80"
          >
            <Coins size={18} color="#a3e635" />
            <Text className="text-lime-400 font-bold ml-2">Side Games</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={showTeamModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#141414] rounded-t-3xl border-t border-neutral-800 px-5 pt-5 pb-10 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-xl font-bold">
                {editingTeam ? 'Manage Players' : 'Add Team'}
              </Text>
              <Pressable onPress={closeTeamModal}>
                <X size={22} color="#737373" />
              </Pressable>
            </View>

            <ScrollView>
              {!editingTeam && (
                <>
                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                    Side
                  </Text>
                  <View className="flex-row gap-2 mb-4">
                    {(['side_a', 'side_b'] as const)
                      .filter((side) => (side === 'side_a' ? !sideATeam : !sideBTeam))
                      .map((side) => (
                        <Pressable
                          key={side}
                          onPress={() => setTeamSide(side)}
                          className={cn(
                            'flex-1 py-2 rounded-lg border items-center',
                            teamSide === side
                              ? 'bg-lime-900/40 border-lime-600'
                              : 'bg-[#0c0c0c] border-neutral-800'
                          )}
                        >
                          <Text
                            className={
                              teamSide === side ? 'text-lime-400 font-semibold' : 'text-neutral-500'
                            }
                          >
                            {side === 'side_a' ? 'Team A' : 'Team B'}
                          </Text>
                        </Pressable>
                      ))}
                  </View>

                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                    Team Name
                  </Text>
                  <TextInput
                    value={teamName}
                    onChangeText={setTeamName}
                    placeholder="Team Smith"
                    placeholderTextColor="#525252"
                    className="bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white mb-4"
                  />
                </>
              )}

              {editingTeam && activeEditingTeam && (
                <View className="bg-[#0c0c0c] border border-neutral-800 rounded-xl p-4 mb-4">
                  <Text className="text-white font-bold">{activeEditingTeam.team_name}</Text>
                  <Text className="text-neutral-500 text-xs mt-1">
                    {editingTeamRoster.length} player{editingTeamRoster.length !== 1 ? 's' : ''} on roster
                  </Text>
                </View>
              )}

              <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                Add Player by Name
              </Text>
              <View className="flex-row gap-2 mb-2">
                <TextInput
                  value={newPlayerName}
                  onChangeText={setNewPlayerName}
                  placeholder="Player name"
                  placeholderTextColor="#525252"
                  className="flex-1 bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white"
                />
                <TextInput
                  value={newPlayerHandicap}
                  onChangeText={setNewPlayerHandicap}
                  placeholder="HI"
                  placeholderTextColor="#525252"
                  keyboardType="decimal-pad"
                  className="w-16 bg-[#0c0c0c] border border-neutral-800 rounded-xl px-3 py-3 text-white text-center"
                />
              </View>
              <Pressable
                onPress={editingTeam ? addPlayerToExistingTeam : addDraftPlayerByName}
                disabled={!newPlayerName.trim() || addPlayerMutation.isPending}
                className="flex-row items-center justify-center bg-neutral-800 rounded-xl py-3 mb-4 active:opacity-80"
              >
                <UserPlus size={16} color="#a3e635" />
                <Text className="text-lime-400 font-semibold ml-2">Add Player</Text>
              </Pressable>

              <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                Or Add Club Member
              </Text>
              <View className="mb-4">
                {members.map((member) => {
                  const onRoster = editingTeam
                    ? editingTeamRoster.some((entry) => entry.user_id === member.id)
                    : rosterDraft.some((entry) => entry.user_id === member.id);
                  return (
                    <Pressable
                      key={member.id}
                      onPress={() =>
                        editingTeam
                          ? addMemberToExistingTeam(member.id)
                          : addDraftMember(member.id)
                      }
                      disabled={onRoster || addPlayerMutation.isPending}
                      className={cn(
                        'flex-row items-center justify-between px-4 py-3 rounded-xl mb-2 border',
                        onRoster
                          ? 'bg-neutral-900 border-neutral-800 opacity-50'
                          : 'bg-[#0c0c0c] border-neutral-800 active:opacity-80'
                      )}
                    >
                      <Text className="text-white font-medium">{member.full_name}</Text>
                      <Text className="text-neutral-500 text-sm">
                        {onRoster ? 'Added' : `${member.handicap_index?.toFixed(1) ?? '--'} HI`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                {editingTeam ? 'Current Roster' : `Roster (${rosterDraft.length})`}
              </Text>
              {!editingTeam ? (
                rosterDraft.length === 0 ? (
                  <Text className="text-neutral-500 text-sm mb-4">Add at least one player.</Text>
                ) : (
                  rosterDraft.map((entry) => (
                    <View
                      key={entry.key}
                      className="flex-row items-center justify-between bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 mb-2"
                    >
                      <View>
                        <Text className="text-white font-medium">{entry.display_name}</Text>
                        <Text className="text-neutral-500 text-xs mt-0.5">
                          {entry.handicap_index.toFixed(1)} HI
                          {entry.user_id ? ' · Member' : ' · Guest'}
                        </Text>
                      </View>
                      <Pressable onPress={() => removeDraftPlayer(entry.key)}>
                        <Trash2 size={16} color="#737373" />
                      </Pressable>
                    </View>
                  ))
                )
              ) : editingTeamRoster.length === 0 ? (
                <Text className="text-neutral-500 text-sm mb-4">Add at least one player.</Text>
              ) : (
                editingTeamRoster.map((entry) => (
                  <View
                    key={entry.id}
                    className="flex-row items-center justify-between bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 mb-2"
                  >
                    <View>
                      <Text className="text-white font-medium">{entry.display_name}</Text>
                      <Text className="text-neutral-500 text-xs mt-0.5">
                        {entry.handicap_index.toFixed(1)} HI
                        {entry.user_id ? ' · Member' : ' · Guest'}
                      </Text>
                    </View>
                    {editingTeamRoster.length > 1 && activeEditingTeam ? (
                      <Pressable
                        onPress={() =>
                          removePlayerMutation.mutate({
                            team: activeEditingTeam,
                            playerId: entry.id,
                          })
                        }
                        disabled={removePlayerMutation.isPending}
                      >
                        <Trash2 size={16} color="#737373" />
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}
            </ScrollView>

            {!editingTeam && (
              <Pressable
                onPress={handleCreateTeam}
                disabled={
                  createTeamMutation.isPending ||
                  !teamName.trim() ||
                  rosterDraft.length === 0
                }
                className="bg-lime-600 rounded-xl py-4 items-center mt-4"
              >
                {createTeamMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold">Save Team</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
