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
  getTeamRosterStatusLabel,
} from '@/lib/tournament-roster-utils';
import { getTeamSideDisplayName, tournamentNeedsTeams } from '@/lib/tournament-labels';
import { updateTournamentTeam } from '@/lib/tournament-service';
import { requireData } from '@/lib/tournament-supabase';
import type { Tournament, TournamentPlayer, TournamentTeam, TournamentTeamSide } from '@/types';
import { cn } from '@/lib/cn';
import { webPressHandler } from '@/lib/web-press';

const modalInputClassName =
  'bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white text-base';
const modalInputStyle = { color: '#ffffff' };

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
}: TournamentTeamsRosterTabProps) {
  const queryClient = useQueryClient();
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TournamentTeam | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamSide, setTeamSide] = useState<TournamentTeamSide>('side_a');
  const [captainUserId, setCaptainUserId] = useState<string | null>(null);
  const [editingCaptainUserId, setEditingCaptainUserId] = useState<string | null>(null);
  const [rosterDraft, setRosterDraft] = useState<RosterDraftEntry[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerHandicap, setNewPlayerHandicap] = useState('');

  const sideATeam = getTeamBySide(teams, 'side_a');
  const sideBTeam = getTeamBySide(teams, 'side_b');
  const canAddTeam = !sideATeam || !sideBTeam;
  const myCaptainTeam = teams.find((team) => team.captain_user_id === userId) ?? null;

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
    mutationFn: async (params: { teamId: string; captainUserId: string }) => {
      const result = await updateTournamentTeam(
        params.teamId,
        { captain_user_id: params.captainUserId },
        { tournamentId, accessToken }
      );
      return requireData(result, 'Could not update captain');
    },
    onSuccess: (updatedTeam) => {
      patchTeamInCache(updatedTeam);
      setEditingCaptainUserId(updatedTeam.captain_user_id);
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
        { tournamentId, accessToken }
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
    setEditingCaptainUserId(null);
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
    setEditingCaptainUserId(team.captain_user_id);
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
  const editingTeamRoster = activeEditingTeam
    ? resolveRosterEntries(activeEditingTeam.player_ids, tournamentPlayers, members)
    : [];

  const selectEditingCaptain = (memberId: string) => {
    if (!activeEditingTeam) return;
    setEditingCaptainUserId(memberId);
    updateCaptainMutation.mutate({
      teamId: activeEditingTeam.id,
      captainUserId: memberId,
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

  return (
    <View>
      {introText ? (
        <View className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-3 mb-3">
          <Text className="text-neutral-300 text-sm">{introText}</Text>
        </View>
      ) : null}

      {myCaptainTeam && canCaptainManageRoster(myCaptainTeam, userId) ? (
        <View className="bg-lime-900/20 border border-lime-700/40 rounded-xl px-4 py-3 mb-3">
          <View className="flex-row items-center">
            <Shield size={16} color="#a3e635" />
            <Text className="text-lime-400 font-semibold text-sm ml-2">
              You're the captain — build your roster
            </Text>
          </View>
          <Pressable onPress={() => openManageRoster(myCaptainTeam)} className="mt-3 self-start active:opacity-80">
            <Text className="text-lime-400 font-semibold text-sm">Manage roster</Text>
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

      {teams.map((team, index) => {
        const captainName = team.captain_user_id
          ? members.find((member) => member.id === team.captain_user_id)?.full_name ?? 'Captain'
          : null;
        const canManageRoster = canManageTeamRoster(team, { isManager, userId });

        return (
          <Animated.View
            key={team.id}
            entering={FadeInDown.delay(index * 50).duration(300)}
            className="bg-[#141414] border border-neutral-800 rounded-xl p-4 mb-3"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-white font-bold text-base">{team.team_name}</Text>
              <View className="bg-neutral-900 border border-neutral-700 rounded-full px-2 py-0.5">
                <Text className="text-neutral-300 text-[10px] font-bold uppercase">
                  {getTeamRosterStatusLabel(team)}
                </Text>
              </View>
            </View>
            {captainName ? (
              <Text className="text-neutral-500 text-xs mt-2">Captain: {captainName}</Text>
            ) : isManager ? (
              <Text className="text-amber-500/90 text-xs mt-2">Captain optional for now</Text>
            ) : null}
            <Text className="text-neutral-500 text-xs mt-2 uppercase tracking-widest">Players</Text>
            {team.player_ids.map((playerId) => (
              <Text key={playerId} className="text-neutral-300 text-sm mt-1">
                • {playerNameById[playerId] ?? 'Player'}
              </Text>
            ))}
            {canManageRoster ? (
              <Pressable
                onPress={() => openManageRoster(team)}
                className="flex-row items-center mt-3 pt-3 border-t border-neutral-800 active:opacity-80"
              >
                <UserPlus size={14} color="#a3e635" />
                <Text className="text-lime-400 font-semibold text-sm ml-2">
                  {isManager ? 'Manage Team' : 'Manage Players'}
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
        );
      })}

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
                            {getTeamSideDisplayName(side, teams)}
                          </Text>
                        </Pressable>
                      ))}
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
                    Tap a club member below to set captain. Names come from member profiles — they
                    are not edited here.
                  </Text>
                  <View className="mb-4">
                    {members.map((member) => (
                      <Pressable
                        key={member.id}
                        onPress={() => selectEditingCaptain(member.id)}
                        disabled={updateCaptainMutation.isPending}
                        className={cn(
                          'flex-row items-center justify-between px-4 py-3 rounded-xl mb-2 border',
                          editingCaptainUserId === member.id
                            ? 'bg-lime-900/30 border-lime-600'
                            : 'bg-[#0c0c0c] border-neutral-800 active:opacity-80'
                        )}
                      >
                        <View>
                          <Text
                            className={
                              editingCaptainUserId === member.id
                                ? 'text-lime-400 font-semibold'
                                : 'text-white font-medium'
                            }
                          >
                            {member.full_name}
                          </Text>
                        </View>
                        <Text className="text-neutral-500 text-sm">
                          {editingCaptainUserId === member.id ? 'Selected' : 'Tap to select'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
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
