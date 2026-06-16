import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { Plus, X, UserPlus, UserMinus, Pencil, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getTeamBySide } from '@/lib/tournament-match-service';
import {
  assignPlayersToTeam,
  createEmptyTournamentTeam,
  removePlayerFromTeam,
} from '@/lib/tournament-player-service';
import {
  getUnassignedPlayers,
  playerIdsEqual,
  resolveParticipantEmail,
  resolveTeamParticipants,
  sanitizeTeamPlayerIds,
} from '@/lib/tournament-participant-utils';
import { updateTournamentTeam } from '@/lib/tournament-service';
import { getTeamSideDisplayName, tournamentNeedsTeams } from '@/lib/tournament-labels';
import { requireData } from '@/lib/tournament-supabase';
import type { Tournament, TournamentPlayer, TournamentTeam, TournamentTeamSide } from '@/types';
import { cn } from '@/lib/cn';
import { webPressHandler } from '@/lib/web-press';

interface TournamentTeamsAssignTabProps {
  tournamentId: string;
  tournament: Tournament;
  teams: TournamentTeam[];
  participants: TournamentPlayer[];
  members: Array<{ id: string; email?: string | null }>;
  accessToken: string;
}

export function TournamentTeamsAssignTab({
  tournamentId,
  tournament,
  teams,
  participants,
  members,
  accessToken,
}: TournamentTeamsAssignTabProps) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TournamentTeam | null>(null);
  const [editingTeamNameId, setEditingTeamNameId] = useState<string | null>(null);
  const [inlineTeamName, setInlineTeamName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamSide, setTeamSide] = useState<TournamentTeamSide>('side_a');

  const sideATeam = getTeamBySide(teams, 'side_a');
  const sideBTeam = getTeamBySide(teams, 'side_b');
  const canAddTeam = !sideATeam || !sideBTeam;
  const unassigned = getUnassignedPlayers(participants, teams);

  const memberEmailByUserId = Object.fromEntries(
    members.filter((m) => m.email).map((m) => [m.id, m.email as string])
  );

  const refresh = () => {
    void queryClient.refetchQueries({ queryKey: ['tournamentTeams', tournamentId] });
    void queryClient.refetchQueries({ queryKey: ['tournamentPlayers', tournamentId] });
  };

  const sanitizingRef = useRef(false);

  useEffect(() => {
    if (teams.length === 0 || sanitizingRef.current) return;

    const teamsNeedingCleanup = teams.filter((team) => {
      const cleaned = sanitizeTeamPlayerIds(team.player_ids, participants);
      return !playerIdsEqual(team.player_ids, cleaned);
    });

    if (teamsNeedingCleanup.length === 0) return;

    let cancelled = false;
    sanitizingRef.current = true;

    void (async () => {
      for (const team of teamsNeedingCleanup) {
        if (cancelled) break;
        const cleaned = sanitizeTeamPlayerIds(team.player_ids, participants);
        await updateTournamentTeam(
          team.id,
          { player_ids: cleaned },
          { tournamentId, accessToken }
        );
      }
      if (!cancelled) {
        refresh();
      }
      sanitizingRef.current = false;
    })();

    return () => {
      cancelled = true;
      sanitizingRef.current = false;
    };
  }, [teams, participants, tournamentId, accessToken]);

  const createTeamMutation = useMutation({
    mutationFn: async () => {
      const trimmed = teamName.trim();
      if (!trimmed) throw new Error('Team name is required');
      const side: TournamentTeamSide =
        teamSide === 'side_a' && !sideATeam
          ? 'side_a'
          : teamSide === 'side_b' && !sideBTeam
            ? 'side_b'
            : sideATeam
              ? 'side_b'
              : 'side_a';
      const result = await createEmptyTournamentTeam({
        tournament_id: tournamentId,
        team_name: trimmed,
        side,
      });
      return requireData(result, 'Could not create team');
    },
    onSuccess: () => {
      setShowModal(false);
      setTeamName('');
      refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => Alert.alert('Could not create team', error.message),
  });

  const saveNameMutation = useMutation({
    mutationFn: async (params: { teamId: string; team_name: string }) => {
      const result = await updateTournamentTeam(
        params.teamId,
        { team_name: params.team_name },
        { tournamentId, accessToken }
      );
      return requireData(result, 'Could not save team name');
    },
    onSuccess: (updatedTeam) => {
      if (editingTeam?.id === updatedTeam.id) {
        setEditingTeam(updatedTeam);
      }
      setEditingTeamNameId(null);
      setInlineTeamName('');
      refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => Alert.alert('Save failed', error.message),
  });

  const startEditingTeamName = (team: TournamentTeam) => {
    setEditingTeamNameId(team.id);
    setInlineTeamName(team.team_name);
  };

  const cancelEditingTeamName = () => {
    setEditingTeamNameId(null);
    setInlineTeamName('');
  };

  const assignMutation = useMutation({
    mutationFn: async (params: { team: TournamentTeam; playerId: string }) => {
      const result = await assignPlayersToTeam(params.team, [params.playerId]);
      return requireData(result, 'Could not assign player');
    },
    onSuccess: (updatedTeam) => {
      setEditingTeam((current) => (current?.id === updatedTeam.id ? updatedTeam : current));
      refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => Alert.alert('Assign failed', error.message),
  });

  const unassignMutation = useMutation({
    mutationFn: async (params: {
      team: TournamentTeam;
      playerId: string;
      player: TournamentPlayer;
    }) => {
      const result = await removePlayerFromTeam(params.team, params.playerId, params.player);
      return requireData(result, 'Could not remove player from team');
    },
    onSuccess: (updatedTeam) => {
      setEditingTeam((current) => (current?.id === updatedTeam.id ? updatedTeam : current));
      refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => Alert.alert('Remove failed', error.message),
  });

  const openCreate = () => {
    setEditingTeam(null);
    setTeamName('');
    setTeamSide(sideATeam ? 'side_b' : 'side_a');
    setShowModal(true);
  };

  const openAssign = (team: TournamentTeam) => {
    setEditingTeam(team);
    setShowModal(true);
  };

  const activeEditingTeam = editingTeam
    ? teams.find((team) => team.id === editingTeam.id) ?? editingTeam
    : null;
  const editingTeamRoster = activeEditingTeam
    ? resolveTeamParticipants(activeEditingTeam, participants)
    : [];

  if (!tournamentNeedsTeams(tournament)) {
    return (
      <Text className="text-neutral-500 text-sm text-center px-4">
        All rounds are singles — no teams required.
      </Text>
    );
  }

  return (
    <View>
      <View className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-3 mb-4">
        <Text className="text-neutral-300 text-sm">
          Step 2: Create team names, then assign people from your participant list. Unassigned
          players: {unassigned.length}.
        </Text>
      </View>

      {canAddTeam ? (
        <Pressable
          onPress={openCreate}
          className="flex-row items-center justify-center bg-[#141414] border border-dashed border-neutral-700 rounded-xl py-3 mb-3 active:opacity-80"
        >
          <Plus size={18} color="#a3e635" />
          <Text className="text-lime-400 font-semibold ml-2">
            Add {sideATeam ? getTeamSideDisplayName('side_b', teams) : getTeamSideDisplayName('side_a', teams)}
          </Text>
        </Pressable>
      ) : null}

      {teams.map((team) => {
        const isEditingName = editingTeamNameId === team.id;
        const isSavingName =
          saveNameMutation.isPending && saveNameMutation.variables?.teamId === team.id;
        const teamRoster = resolveTeamParticipants(team, participants);

        return (
        <View
          key={team.id}
          className="bg-[#141414] border border-neutral-800 rounded-xl p-4 mb-3"
        >
          {isEditingName ? (
            <View className="mb-2">
              <TextInput
                value={inlineTeamName}
                onChangeText={setInlineTeamName}
                placeholder="Team name"
                placeholderTextColor="#525252"
                autoFocus
                autoCorrect={false}
                className="bg-[#0c0c0c] border border-lime-600/40 rounded-xl px-4 py-3 text-white mb-2"
                style={{ color: '#ffffff' }}
              />
              <View className="flex-row gap-2">
                <Pressable
                  onPress={webPressHandler(() => {
                    const trimmed = inlineTeamName.trim();
                    if (!trimmed || trimmed === team.team_name) {
                      cancelEditingTeamName();
                      return;
                    }
                    saveNameMutation.mutate({ teamId: team.id, team_name: trimmed });
                  })}
                  disabled={isSavingName || !inlineTeamName.trim()}
                  className="flex-1 flex-row items-center justify-center bg-lime-600 rounded-xl py-2.5 active:opacity-80"
                >
                  {isSavingName ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Check size={16} color="#fff" />
                      <Text className="text-white font-semibold ml-1.5">Save</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  onPress={webPressHandler(cancelEditingTeamName)}
                  disabled={isSavingName}
                  className="flex-row items-center justify-center px-4 rounded-xl py-2.5 bg-neutral-900 border border-neutral-800 active:opacity-80"
                >
                  <X size={16} color="#a3a3a3" />
                  <Text className="text-neutral-400 font-semibold ml-1.5">Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-white font-bold text-base flex-1 pr-2">{team.team_name}</Text>
              <Pressable
                onPress={webPressHandler(() => startEditingTeamName(team))}
                disabled={editingTeamNameId != null}
                className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 active:opacity-80"
                accessibilityLabel={`Edit ${team.team_name}`}
              >
                <Pencil size={16} color="#a3e635" />
              </Pressable>
            </View>
          )}
          <Text className="text-neutral-500 text-xs mt-1 mb-2">
            {teamRoster.length} player{teamRoster.length !== 1 ? 's' : ''}
          </Text>
          {teamRoster.map((player) => (
              <View key={player.id} className="flex-row items-center justify-between py-1">
                <Text className="text-neutral-300 text-sm flex-1">
                  {player.display_name}
                  {' · '}
                  {resolveParticipantEmail(player, memberEmailByUserId) ?? 'no email'}
                </Text>
              </View>
            ))}
          <Pressable
            onPress={() => openAssign(team)}
            className="flex-row items-center mt-3 pt-3 border-t border-neutral-800 active:opacity-80"
          >
            <UserPlus size={14} color="#a3e635" />
            <Text className="text-lime-400 font-semibold text-sm ml-2">Assign from participant list</Text>
          </Pressable>
        </View>
        );
      })}

      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#141414] rounded-t-3xl border-t border-neutral-800 px-5 pt-5 pb-10 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-xl font-bold">
                {editingTeam ? 'Manage Team' : 'Add Team'}
              </Text>
              <Pressable onPress={() => setShowModal(false)}>
                <X size={22} color="#737373" />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {!editingTeam ? (
                <>
                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                    Team name
                  </Text>
                  <TextInput
                    value={teamName}
                    onChangeText={setTeamName}
                    placeholder="Team name"
                    placeholderTextColor="#525252"
                    autoCorrect={false}
                    className="bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white mb-4"
                    style={{ color: '#ffffff' }}
                  />
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
                </>
              ) : null}

              {activeEditingTeam ? (
                <>
                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                    On this team
                  </Text>
                  {editingTeamRoster.length === 0 ? (
                    <Text className="text-neutral-500 text-sm mb-4">No players assigned yet.</Text>
                  ) : (
                    editingTeamRoster.map((player) => (
                        <View
                          key={player.id}
                          className="flex-row items-center justify-between bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 mb-2"
                        >
                          <Text className="text-white font-medium">{player.display_name}</Text>
                          <Pressable
                            onPress={() =>
                              unassignMutation.mutate({
                                team: activeEditingTeam,
                                playerId: player.id,
                                player,
                              })
                            }
                          >
                            <UserMinus size={16} color="#737373" />
                          </Pressable>
                        </View>
                      ))
                  )}

                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2 mt-2">
                    Unassigned ({unassigned.length})
                  </Text>
                  {unassigned.length === 0 ? (
                    <Text className="text-neutral-500 text-sm mb-4">Everyone is on a team.</Text>
                  ) : (
                    unassigned.map((player) => (
                      <Pressable
                        key={player.id}
                        onPress={() =>
                          assignMutation.mutate({ team: activeEditingTeam, playerId: player.id })
                        }
                        className="flex-row items-center justify-between bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 mb-2 active:opacity-80"
                      >
                        <View>
                          <Text className="text-white font-medium">{player.display_name}</Text>
                          <Text className="text-neutral-500 text-xs">
                            {resolveParticipantEmail(player, memberEmailByUserId) ?? 'no email'}
                          </Text>
                        </View>
                        <Text className="text-lime-400 text-xs font-semibold">Add</Text>
                      </Pressable>
                    ))
                  )}
                </>
              ) : null}
            </ScrollView>

            {!editingTeam ? (
              <Pressable
                onPress={webPressHandler(() => createTeamMutation.mutate())}
                disabled={createTeamMutation.isPending || !teamName.trim()}
                className="bg-lime-600 rounded-xl py-4 items-center mt-4"
              >
                {createTeamMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold">Create team</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
