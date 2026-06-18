import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Plus, Shield, UserPlus, X } from 'lucide-react-native';
import { Image } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  TournamentRosterEditor,
  type RosterDraftEntry,
  type RosterMemberOption,
} from '@/components/TournamentRosterEditor';
import { getTeamBySide } from '@/lib/tournament-match-service';
import {
  appendPlayersToTeam,
  createTournamentTeamWithRoster,
  removePlayerFromTeam,
  resolveRosterEntries,
} from '@/lib/tournament-player-service';
import {
  canCaptainManageRoster,
  canManageTeamRoster,
} from '@/lib/tournament-roster-utils';
import {
  buildCaptainTeamUpdate,
  isTeamCaptainPlayer,
  resolveCaptainDisplayName,
  resolveTeamParticipants,
} from '@/lib/tournament-participant-utils';
import { getTeamSideDisplayName, tournamentNeedsTeams } from '@/lib/tournament-labels';
import { getTeamSideTheme } from '@/lib/match-play-theme';
import { updateTournamentTeam } from '@/lib/tournament-service';
import { requireData } from '@/lib/tournament-supabase';
import type { Tournament, TournamentPlayer, TournamentTeam, TournamentTeamSide } from '@/types';
import { cn } from '@/lib/cn';
import { webPressHandler } from '@/lib/web-press';

const modalInputClassName =
  'bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white text-base';
const modalInputStyle = { color: '#ffffff' };

function resolveTeamSide(team: TournamentTeam, teams: TournamentTeam[]): TournamentTeamSide {
  if (team.side === 'side_a' || team.side === 'side_b') return team.side;
  if (getTeamBySide(teams, 'side_a')?.id === team.id) return 'side_a';
  return 'side_b';
}

function HeroTeamPlayerList({
  playerIds,
  playerNameById,
  accentColor,
}: {
  playerIds: string[];
  playerNameById: Record<string, string>;
  accentColor: string;
}) {
  const playerCount = playerIds.length;
  const useTwoColumns = playerCount >= 4;
  const splitAt = Math.ceil(playerCount / 2);
  const leftColumn = useTwoColumns ? playerIds.slice(0, splitAt) : playerIds;
  const rightColumn = useTwoColumns ? playerIds.slice(splitAt) : [];
  const nameSize = playerCount > 12 ? 9 : playerCount > 8 ? 10 : 11;

  const renderName = (playerId: string) => (
    <View
      key={playerId}
      style={{
        paddingVertical: 3,
        paddingHorizontal: 2,
        borderBottomWidth: 1,
        borderBottomColor: `${accentColor}33`,
      }}
    >
      <Text
        style={{
          color: '#e5e5e5',
          fontSize: nameSize,
          fontWeight: '500',
          lineHeight: nameSize + 3,
        }}
        numberOfLines={2}
      >
        {playerNameById[playerId] ?? 'Player'}
      </Text>
    </View>
  );

  if (playerCount === 0) {
    return (
      <Text style={{ color: '#525252', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
        No players yet
      </Text>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 4 }}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <View style={{ flex: 1, minWidth: 0 }}>{leftColumn.map(renderName)}</View>
        {useTwoColumns ? (
          <View style={{ flex: 1, minWidth: 0 }}>{rightColumn.map(renderName)}</View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function HeroTeamPanel({
  team,
  teams,
  playerNameById,
  members,
  isManager,
  userId,
  onManageRoster,
}: {
  team: TournamentTeam;
  teams: TournamentTeam[];
  playerNameById: Record<string, string>;
  members: RosterMemberOption[];
  isManager: boolean;
  userId?: string;
  onManageRoster: (team: TournamentTeam) => void;
}) {
  const captainName = team.captain_player_id
    ? playerNameById[team.captain_player_id] ?? null
    : team.captain_user_id
      ? members.find((member) => member.id === team.captain_user_id)?.full_name ?? null
      : null;
  const canManageRoster = canManageTeamRoster(team, { isManager, userId });
  const theme = getTeamSideTheme(resolveTeamSide(team, teams));

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        paddingHorizontal: 4,
      }}
    >
      <View
        style={{
          flex: 1,
          borderWidth: 2,
          borderColor: theme.panelBorder,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: '#0a0a0a',
        }}
      >
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 12,
            borderBottomWidth: 2,
            borderBottomColor: theme.color,
            backgroundColor: theme.panelBg,
            alignItems: 'center',
          }}
        >
          {team.logo_url ? (
            <View
              style={{
                padding: 3,
                borderRadius: 27,
                borderWidth: 2,
                borderColor: theme.ringBorder,
                backgroundColor: theme.ringGlow,
                marginBottom: 6,
              }}
            >
              <Image
                source={{ uri: team.logo_url }}
                style={{ width: 48, height: 48, borderRadius: 24 }}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                marginBottom: 6,
                borderWidth: 2,
                borderColor: theme.ringBorder,
                backgroundColor: theme.ringGlow,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.colorLight, fontSize: 22, fontWeight: '700' }}>
                {team.team_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text
            style={{
              color: theme.color,
              fontSize: 20,
              fontWeight: '700',
              marginTop: 4,
              textAlign: 'center',
            }}
            numberOfLines={2}
          >
            {team.team_name}
          </Text>
          {captainName ? (
            <Text style={{ color: theme.colorLight, fontSize: 11, marginTop: 4, opacity: 0.85 }} numberOfLines={1}>
              Capt. {captainName}
            </Text>
          ) : null}
        </View>

        <View style={{ flex: 1, paddingHorizontal: 4, paddingVertical: 4, minHeight: 0 }}>
          <HeroTeamPlayerList
            playerIds={team.player_ids}
            playerNameById={playerNameById}
            accentColor={theme.color}
          />
        </View>

        {canManageRoster ? (
          <Pressable
            onPress={() => onManageRoster(team)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              borderTopWidth: 1,
              borderTopColor: theme.panelBorder,
              backgroundColor: theme.ringGlow,
            }}
          >
            <UserPlus size={14} color={theme.color} />
            <Text style={{ color: theme.color, fontSize: 12, fontWeight: '600', marginLeft: 6 }}>
              {isManager ? 'Manage' : 'Roster'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

interface TournamentTeamsRosterTabProps {
  tournamentId: string;
  tournament: Tournament;
  teams: TournamentTeam[];
  members: RosterMemberOption[];
  tournamentPlayers: TournamentPlayer[];
  playerNameById: Record<string, string>;
  isManager: boolean;
  userId?: string;
  accessToken?: string | null;
  introText?: string;
  layout?: 'default' | 'hero';
}

export function TournamentTeamsRosterTab({
  tournamentId,
  tournament,
  teams,
  members,
  tournamentPlayers,
  playerNameById,
  isManager,
  userId,
  accessToken,
  introText,
  layout = 'default',
}: TournamentTeamsRosterTabProps) {
  const queryClient = useQueryClient();
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TournamentTeam | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamSide, setTeamSide] = useState<TournamentTeamSide>('side_a');
  const [captainUserId, setCaptainUserId] = useState<string | null>(null);
  const [editingCaptainPlayerId, setEditingCaptainPlayerId] = useState<string | null>(null);
  const [rosterDraft, setRosterDraft] = useState<RosterDraftEntry[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerHandicap, setNewPlayerHandicap] = useState('');

  const sideATeam = getTeamBySide(teams, 'side_a');
  const sideBTeam = getTeamBySide(teams, 'side_b');
  const canAddTeam = !sideATeam || !sideBTeam;
  const myCaptainTeam = teams.find((team) => team.captain_user_id === userId) ?? null;
  const memberEmailByUserId = Object.fromEntries(
    members.filter((member) => member.email).map((member) => [member.id, member.email as string])
  );

  const patchTeamInCache = (updatedTeam: TournamentTeam) => {
    queryClient.setQueryData(['tournamentTeams', tournamentId], (old: TournamentTeam[] | undefined) =>
      old?.map((team) => (team.id === updatedTeam.id ? updatedTeam : team)) ?? [updatedTeam]
    );
  };

  const refreshRosterData = () => {
    void queryClient.refetchQueries({ queryKey: ['tournamentTeams', tournamentId] });
    void queryClient.refetchQueries({ queryKey: ['tournamentPlayers', tournamentId] });
  };

  const createTeamMutation = useMutation({
    mutationFn: (params: {
      team_name: string;
      side: TournamentTeamSide;
      captain_user_id: string | null;
      roster: RosterDraftEntry[];
    }) =>
      createTournamentTeamWithRoster({
        tournament_id: tournamentId,
        team_name: params.team_name,
        side: params.side,
        captain_user_id: params.captain_user_id,
        roster: params.roster.map((entry) => ({
          display_name: entry.display_name,
          handicap_index: entry.handicap_index,
          user_id: entry.user_id ?? null,
        })),
      }),
    onSuccess: () => {
      refreshRosterData();
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
      refreshRosterData();
      setNewPlayerName('');
      setNewPlayerHandicap('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert('Could not add player', error.message);
    },
  });

  const updateCaptainMutation = useMutation({
    mutationFn: async (params: { teamId: string; player: TournamentPlayer }) => {
      const result = await updateTournamentTeam(
        params.teamId,
        buildCaptainTeamUpdate(params.player, members, memberEmailByUserId),
        { tournamentId, accessToken: accessToken ?? undefined }
      );
      return requireData(result, 'Could not update captain');
    },
    onSuccess: (updatedTeam) => {
      patchTeamInCache(updatedTeam);
      setEditingCaptainPlayerId(updatedTeam.captain_player_id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert('Could not update captain', error.message);
    },
  });

  const updateTeamNameMutation = useMutation({
    mutationFn: async (params: { teamId: string; team_name: string }) => {
      const result = await updateTournamentTeam(
        params.teamId,
        { team_name: params.team_name },
        { tournamentId, accessToken: accessToken ?? undefined }
      );
      return requireData(result, 'Could not update team name');
    },
    onSuccess: (updatedTeam) => {
      patchTeamInCache(updatedTeam);
      setEditingTeam(updatedTeam);
      setTeamName(updatedTeam.team_name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert('Could not save team name', error.message);
    },
  });

  const removePlayerMutation = useMutation({
    mutationFn: async (params: { team: TournamentTeam; playerId: string }) => {
      const result = await removePlayerFromTeam(params.team, params.playerId);
      return requireData(result, 'Could not remove player');
    },
    onSuccess: () => {
      refreshRosterData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert('Could not remove player', error.message);
    },
  });

  const closeTeamModal = () => {
    setShowTeamModal(false);
    setEditingTeam(null);
    setTeamName('');
    setCaptainUserId(null);
    setEditingCaptainPlayerId(null);
    setRosterDraft([]);
    setNewPlayerName('');
    setNewPlayerHandicap('');
  };

  const selectCaptain = (memberId: string) => {
    setCaptainUserId(memberId);
    const member = members.find((entry) => entry.id === memberId);
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
    const member = members.find((entry) => entry.id === memberId);
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
    setTeamName('');
    setTeamSide(sideATeam ? 'side_b' : 'side_a');
    setCaptainUserId(null);
    setRosterDraft([]);
    setNewPlayerName('');
    setNewPlayerHandicap('');
    setShowTeamModal(true);
  };

  const openManageRoster = (team: TournamentTeam) => {
    if (!canManageTeamRoster(team, { isManager, userId })) return;
    setEditingTeam(team);
    setTeamName(team.team_name);
    setEditingCaptainPlayerId(team.captain_player_id);
    setNewPlayerName('');
    setNewPlayerHandicap('');
    setShowTeamModal(true);
  };

  const saveEditingTeamName = () => {
    if (!activeEditingTeam) return;
    const trimmed = teamName.trim();
    if (!trimmed || trimmed === activeEditingTeam.team_name) return;
    updateTeamNameMutation.mutate({
      teamId: activeEditingTeam.id,
      team_name: trimmed,
    });
  };

  const activeEditingTeam = editingTeam
    ? teams.find((team) => team.id === editingTeam.id) ?? editingTeam
    : null;
  const myCaptainTheme = myCaptainTeam
    ? getTeamSideTheme(resolveTeamSide(myCaptainTeam, teams))
    : null;
  const editingTeamRoster = activeEditingTeam
    ? resolveRosterEntries(activeEditingTeam.player_ids, tournamentPlayers, members)
    : [];

  const selectEditingCaptain = (playerId: string) => {
    if (!activeEditingTeam) return;
    const player = tournamentPlayers.find((entry) => entry.id === playerId);
    if (!player) return;
    setEditingCaptainPlayerId(player.id);
    updateCaptainMutation.mutate({
      teamId: activeEditingTeam.id,
      player,
    });
  };

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
    const member = members.find((entry) => entry.id === memberId);
    if (!member) return;
    if (editingTeamRoster.some((entry) => entry.user_id === member.id)) return;
    addPlayerMutation.mutate({
      team: activeEditingTeam,
      display_name: member.full_name,
      handicap_index: member.handicap_index ?? 0,
      user_id: member.id,
    });
  };

  const handleCreateTeam = () => {
    if (!teamName.trim() || rosterDraft.length === 0) return;
    const side: TournamentTeamSide = sideATeam ? 'side_b' : 'side_a';
    createTeamMutation.mutate({
      team_name: teamName.trim(),
      side:
        teamSide === 'side_a' && !sideATeam
          ? 'side_a'
          : teamSide === 'side_b' && !sideBTeam
            ? 'side_b'
            : side,
      captain_user_id: captainUserId,
      roster: rosterDraft,
    });
  };

  const renderTeamColumn = (team: TournamentTeam, index: number) => {
    const teamRoster = resolveTeamParticipants(team, tournamentPlayers);
    const captainName = resolveCaptainDisplayName(
      team,
      teamRoster,
      members,
      memberEmailByUserId
    );
    const canManageRoster = canManageTeamRoster(team, { isManager, userId });
    const isHero = layout === 'hero';
    const theme = getTeamSideTheme(resolveTeamSide(team, teams));

    if (isHero) {
      return (
        <HeroTeamPanel
          key={team.id}
          team={team}
          teams={teams}
          playerNameById={playerNameById}
          members={members}
          isManager={isManager}
          userId={userId}
          onManageRoster={openManageRoster}
        />
      );
    }

    return (
      <Animated.View
        key={team.id}
        entering={FadeInDown.delay(index * 50).duration(300)}
        className="flex-1 rounded-xl min-w-0 overflow-hidden border"
        style={{
          backgroundColor: theme.panelBg,
          borderColor: theme.panelBorder,
        }}
      >
        <View
          className="p-3 items-center border-b-2"
          style={{ borderBottomColor: theme.color }}
        >
          {team.logo_url ? (
            <View
              style={{
                padding: 3,
                borderRadius: 27,
                borderWidth: 2,
                borderColor: theme.ringBorder,
                backgroundColor: theme.ringGlow,
              }}
            >
              <Image
                source={{ uri: team.logo_url }}
                style={{ width: 48, height: 48, borderRadius: 24 }}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{
                borderWidth: 2,
                borderColor: theme.ringBorder,
                backgroundColor: theme.ringGlow,
              }}
            >
              <Text style={{ color: theme.colorLight }} className="font-display text-lg font-bold">
                {team.team_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text
            style={{ color: theme.color }}
            className="font-bold text-lg text-center mt-3"
            numberOfLines={2}
          >
            {team.team_name}
          </Text>
          {captainName ? (
            <Text style={{ color: theme.colorLight }} className="text-[10px] text-center mt-2 opacity-85">
              Capt. {captainName}
            </Text>
          ) : null}
        </View>
        <ScrollView
          className="px-3 py-2"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {team.player_ids.length === 0 ? (
            <Text className="text-neutral-600 text-sm text-center">No players yet</Text>
          ) : (
            team.player_ids.map((playerId) => (
              <Text
                key={playerId}
                className="text-neutral-200 text-xs text-center py-1"
                numberOfLines={1}
              >
                {playerNameById[playerId] ?? 'Player'}
              </Text>
            ))
          )}
        </ScrollView>
        {canManageRoster ? (
          <Pressable
            onPress={() => openManageRoster(team)}
            className="flex-row items-center justify-center py-2.5 border-t active:opacity-80"
            style={{
              borderTopColor: theme.panelBorder,
              backgroundColor: theme.ringGlow,
            }}
          >
            <UserPlus size={12} color={theme.color} />
            <Text style={{ color: theme.color }} className="font-semibold text-[10px] ml-1.5">
              {isManager ? 'Manage' : 'Roster'}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    );
  };

  return (
    <View style={layout === 'hero' ? { flex: 1, width: '100%', paddingTop: 8 } : undefined}>
      {introText && layout !== 'hero' ? (
        <View className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-3 mb-3">
          <Text className="text-neutral-300 text-sm">{introText}</Text>
        </View>
      ) : null}

      {myCaptainTeam && myCaptainTheme && canCaptainManageRoster(myCaptainTeam, userId) && layout !== 'hero' ? (
        <View
          className="rounded-xl px-4 py-3 mb-3 border"
          style={{
            backgroundColor: myCaptainTheme.ringGlow,
            borderColor: myCaptainTheme.panelBorder,
          }}
        >
          <View className="flex-row items-center">
            <Shield size={16} color={myCaptainTheme.color} />
            <Text style={{ color: myCaptainTheme.color }} className="font-semibold text-sm ml-2">
              You're the captain — build your roster
            </Text>
          </View>
          <Pressable onPress={() => openManageRoster(myCaptainTeam)} className="mt-3 self-start active:opacity-80">
            <Text style={{ color: myCaptainTheme.colorLight }} className="font-semibold text-sm">
              Manage roster
            </Text>
          </Pressable>
        </View>
      ) : null}

      {isManager && canAddTeam && tournamentNeedsTeams(tournament) ? (
        <Pressable
          onPress={openTeamModal}
          className="flex-row items-center justify-center bg-[#141414] border border-dashed border-neutral-700 rounded-xl py-3 mb-3 active:opacity-80"
        >
          <Plus size={18} color="#a3e635" />
          <Text className="text-lime-400 font-semibold ml-2">
            Add {sideATeam ? getTeamSideDisplayName('side_b', teams) : getTeamSideDisplayName('side_a', teams)}
          </Text>
        </Pressable>
      ) : null}

      {sideATeam && sideBTeam ? (
        layout === 'hero' ? (
          <View style={{ flex: 1, flexDirection: 'row', width: '100%', alignItems: 'stretch' }}>
            {renderTeamColumn(sideATeam, 0)}
            <View className="items-center justify-center px-1 bg-[#111] border-x border-neutral-800">
              <Text className="text-neutral-600 text-[9px] font-bold tracking-widest">VS</Text>
            </View>
            {renderTeamColumn(sideBTeam, 1)}
          </View>
        ) : (
          <View className="flex-row gap-3 mb-3">
            {renderTeamColumn(sideATeam, 0)}
            {renderTeamColumn(sideBTeam, 1)}
          </View>
        )
      ) : (
        teams.map((team, index) => renderTeamColumn(team, index))
      )}

      {!tournamentNeedsTeams(tournament) && teams.length === 0 ? (
        <Text className="text-neutral-500 text-sm text-center mt-2 px-4">
          All rounds are singles — scores are tracked per member, no teams required.
        </Text>
      ) : null}

      <Modal visible={showTeamModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <View className="flex-1 bg-black/70 justify-end">
            <View className="bg-[#141414] rounded-t-3xl border-t border-neutral-800 px-5 pt-5 pb-10 max-h-[90%]">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-xl font-bold">
                  {editingTeam ? (isManager ? 'Manage Team' : 'Manage Players') : 'Add Team'}
                </Text>
                <Pressable onPress={closeTeamModal}>
                  <X size={22} color="#737373" />
                </Pressable>
              </View>

              {editingTeam && activeEditingTeam && isManager ? (
                <View className="mb-4">
                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                    Team Name
                  </Text>
                  <TextInput
                    value={teamName}
                    onChangeText={setTeamName}
                    placeholder="Team name"
                    placeholderTextColor="#525252"
                    autoCorrect={false}
                    onSubmitEditing={saveEditingTeamName}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    className={modalInputClassName}
                    style={modalInputStyle}
                  />
                  <Pressable
                    onPress={webPressHandler(saveEditingTeamName)}
                    disabled={
                      updateTeamNameMutation.isPending ||
                      !teamName.trim() ||
                      teamName.trim() === activeEditingTeam.team_name
                    }
                    className={cn(
                      'flex-row items-center justify-center rounded-xl py-3 mt-3 border',
                      updateTeamNameMutation.isPending ||
                        !teamName.trim() ||
                        teamName.trim() === activeEditingTeam.team_name
                        ? 'border-neutral-800 bg-neutral-900/50 opacity-50'
                        : 'border-lime-700 bg-lime-900/30 active:opacity-80'
                    )}
                  >
                    {updateTeamNameMutation.isPending ? (
                      <ActivityIndicator color="#a3e635" />
                    ) : (
                      <Text className="text-lime-400 font-semibold">Save Team Name</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}

              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
              {!editingTeam ? (
                <>
                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">Side</Text>
                  <View className="flex-row gap-2 mb-4">
                    {(['side_a', 'side_b'] as const)
                      .filter((side) => (side === 'side_a' ? !sideATeam : !sideBTeam))
                      .map((side) => {
                        const sideTheme = getTeamSideTheme(side);
                        const isSelected = teamSide === side;
                        return (
                        <Pressable
                          key={side}
                          onPress={() => setTeamSide(side)}
                          className="flex-1 py-2 rounded-lg border items-center"
                          style={
                            isSelected
                              ? {
                                  backgroundColor: sideTheme.ringGlow,
                                  borderColor: sideTheme.ringBorder,
                                }
                              : {
                                  backgroundColor: '#0c0c0c',
                                  borderColor: '#262626',
                                }
                          }
                        >
                          <Text
                            style={{ color: isSelected ? sideTheme.color : '#737373' }}
                            className={isSelected ? 'font-semibold' : undefined}
                          >
                            {getTeamSideDisplayName(side, teams)}
                          </Text>
                        </Pressable>
                        );
                      })}
                  </View>

                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">Team Name</Text>
                  <TextInput
                    value={teamName}
                    onChangeText={setTeamName}
                    placeholder="Depends"
                    placeholderTextColor="#525252"
                    autoCorrect={false}
                    className={cn(modalInputClassName, 'mb-4')}
                    style={modalInputStyle}
                  />

                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                    Captain (optional)
                  </Text>
                  <View className="mb-4">
                    {members.map((member) => (
                      <Pressable
                        key={member.id}
                        onPress={() => selectCaptain(member.id)}
                        className={cn(
                          'flex-row items-center justify-between px-4 py-3 rounded-xl mb-2 border',
                          captainUserId === member.id
                            ? 'bg-lime-900/30 border-lime-600'
                            : 'bg-[#0c0c0c] border-neutral-800 active:opacity-80'
                        )}
                      >
                        <View>
                          <Text
                            className={
                              captainUserId === member.id
                                ? 'text-lime-400 font-semibold'
                                : 'text-white font-medium'
                            }
                          >
                            {member.full_name}
                          </Text>
                        </View>
                        <Text className="text-neutral-500 text-sm">
                          {captainUserId === member.id ? 'Selected' : 'Tap to select'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              {editingTeam && activeEditingTeam && isManager ? (
                <>
                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-1">
                    Captain (optional)
                  </Text>
                  <Text className="text-neutral-600 text-xs mb-3">
                    Tap anyone on this team to set them as captain.
                  </Text>
                  {editingTeamRoster.length === 0 ? (
                    <Text className="text-neutral-500 text-sm mb-4">
                      Add players to the team first, then pick a captain.
                    </Text>
                  ) : (
                    <View className="mb-4">
                      {editingTeamRoster.map((player) => {
                        const rosterPlayer = tournamentPlayers.find((entry) => entry.id === player.id);
                        const isSelected =
                          (activeEditingTeam &&
                            rosterPlayer &&
                            isTeamCaptainPlayer(
                              activeEditingTeam,
                              rosterPlayer,
                              members,
                              memberEmailByUserId
                            )) ||
                          editingCaptainPlayerId === player.id;

                        return (
                          <Pressable
                            key={player.id}
                            onPress={() => selectEditingCaptain(player.id)}
                            disabled={updateCaptainMutation.isPending || !rosterPlayer}
                            className={cn(
                              'flex-row items-center justify-between px-4 py-3 rounded-xl mb-2 border',
                              isSelected
                                ? 'bg-lime-900/30 border-lime-600'
                                : 'bg-[#0c0c0c] border-neutral-800 active:opacity-80'
                            )}
                          >
                            <Text
                              className={
                                isSelected
                                  ? 'text-lime-400 font-semibold'
                                  : 'text-white font-medium'
                              }
                            >
                              {player.display_name}
                            </Text>
                            <Text className="text-neutral-500 text-sm">
                              {isSelected ? 'Captain' : 'Tap to select'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : editingTeam && activeEditingTeam ? (
                <View className="bg-[#0c0c0c] border border-neutral-800 rounded-xl p-4 mb-4">
                  <Text className="text-white font-bold">{activeEditingTeam.team_name}</Text>
                  <Text className="text-neutral-500 text-xs mt-1">
                    {editingTeamRoster.length} player{editingTeamRoster.length !== 1 ? 's' : ''} on roster
                  </Text>
                </View>
              ) : null}

              <TournamentRosterEditor
                members={members}
                mode={editingTeam ? 'editing' : 'draft'}
                draftRoster={rosterDraft}
                editingRoster={editingTeamRoster}
                newPlayerName={newPlayerName}
                newPlayerHandicap={newPlayerHandicap}
                onNewPlayerNameChange={setNewPlayerName}
                onNewPlayerHandicapChange={setNewPlayerHandicap}
                onAddPlayerByName={editingTeam ? addPlayerToExistingTeam : addDraftPlayerByName}
                onAddMember={editingTeam ? addMemberToExistingTeam : addDraftMember}
                onRemoveDraftPlayer={removeDraftPlayer}
                onRemoveEditingPlayer={(playerId) => {
                  if (!activeEditingTeam) return;
                  removePlayerMutation.mutate({
                    team: activeEditingTeam,
                    playerId,
                  });
                }}
                canRemoveEditingPlayers={Boolean(
                  activeEditingTeam &&
                    canManageTeamRoster(activeEditingTeam, { isManager, userId })
                )}
                isAddingPlayer={addPlayerMutation.isPending}
                isRemovingPlayer={removePlayerMutation.isPending}
              />
            </ScrollView>

            {!editingTeam ? (
              <Pressable
                onPress={webPressHandler(handleCreateTeam)}
                disabled={
                  createTeamMutation.isPending || !teamName.trim() || rosterDraft.length === 0
                }
                className="bg-lime-600 rounded-xl py-4 items-center mt-4"
              >
                {createTeamMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold">Save Team</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
