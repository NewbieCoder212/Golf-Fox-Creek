import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createTournamentPlayer, deleteTournamentPlayer, updateTournamentPlayer } from '@/lib/tournament-player-service';
import {
  getTeamForPlayer,
  isValidEmail,
  resolveParticipantEmail,
} from '@/lib/tournament-participant-utils';
import { requireData } from '@/lib/tournament-supabase';
import type { Tournament, TournamentPlayer, TournamentTeam } from '@/types';
import { cn } from '@/lib/cn';
import { webPressHandler, confirmDestructiveAction } from '@/lib/web-press';

interface MemberOption {
  id: string;
  full_name: string;
  email?: string | null;
  handicap_index: number | null;
}

interface TournamentParticipantsTabProps {
  tournamentId: string;
  tournament: Tournament;
  participants: TournamentPlayer[];
  teams: TournamentTeam[];
  members: MemberOption[];
  accessToken: string;
}

const inputClassName =
  'bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white text-base';
const inputStyle = { color: '#ffffff' as const };

export function TournamentParticipantsTab({
  tournamentId,
  participants,
  teams,
  members,
  accessToken,
}: TournamentParticipantsTabProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [handicap, setHandicap] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editHandicap, setEditHandicap] = useState('');

  const memberEmailByUserId = Object.fromEntries(
    members.filter((m) => m.email).map((m) => [m.id, m.email as string])
  );

  const refresh = () => {
    void queryClient.refetchQueries({ queryKey: ['tournamentPlayers', tournamentId] });
    void queryClient.refetchQueries({ queryKey: ['tournamentTeams', tournamentId] });
    void queryClient.refetchQueries({ queryKey: ['tournamentMatchGroups', tournamentId] });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const displayName = name.trim();
      const emailValue = email.trim().toLowerCase();
      if (!displayName) throw new Error('Name is required');
      if (!emailValue || !isValidEmail(emailValue)) throw new Error('A valid email is required');
      const hi = Number(handicap);

      const result = await createTournamentPlayer({
        tournament_id: tournamentId,
        display_name: displayName,
        email: emailValue,
        handicap_index: Number.isFinite(hi) ? hi : null,
      });
      return requireData(result, 'Could not add participant');
    },
    onSuccess: () => {
      setName('');
      setEmail('');
      setHandicap('');
      refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => Alert.alert('Could not add participant', error.message),
  });

  const addMemberMutation = useMutation({
    mutationFn: async (member: MemberOption) => {
      if (!member.email?.trim()) {
        throw new Error(`${member.full_name} has no email on file`);
      }
      if (participants.some((p) => p.user_id === member.id)) {
        throw new Error(`${member.full_name} is already on the list`);
      }
      const result = await createTournamentPlayer({
        tournament_id: tournamentId,
        display_name: member.full_name,
        email: member.email.trim().toLowerCase(),
        handicap_index: member.handicap_index,
        user_id: member.id,
      });
      return requireData(result, 'Could not add member');
    },
    onSuccess: () => {
      refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => Alert.alert('Could not add member', error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (playerId: string) => {
      const result = await deleteTournamentPlayer(playerId, {
        tournamentId,
        accessToken,
      });
      return requireData(result, 'Could not delete participant');
    },
    onSuccess: () => {
      refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => Alert.alert('Could not delete', error.message),
  });

  const handleDelete = (player: TournamentPlayer) => {
    const onTeam = getTeamForPlayer(player, teams);
    const message = onTeam
      ? `${player.display_name} is on ${onTeam.team_name}. They will be removed from the team and pairings too.`
      : `Remove ${player.display_name} from this event?`;

    confirmDestructiveAction('Remove participant?', message, 'Remove', () => {
      deleteMutation.mutate(player.id);
    });
  };

  const startEditing = (player: TournamentPlayer) => {
    const resolvedEmail = resolveParticipantEmail(player, memberEmailByUserId);
    setEditingPlayerId(player.id);
    setEditName(player.display_name);
    setEditEmail(resolvedEmail ?? player.email ?? '');
    setEditHandicap(
      player.handicap_index != null ? String(player.handicap_index) : ''
    );
  };

  const cancelEditing = () => {
    setEditingPlayerId(null);
    setEditName('');
    setEditEmail('');
    setEditHandicap('');
  };

  const updateMutation = useMutation({
    mutationFn: async (playerId: string) => {
      const displayName = editName.trim();
      const emailValue = editEmail.trim().toLowerCase();
      if (!displayName) throw new Error('Name is required');
      if (!emailValue || !isValidEmail(emailValue)) throw new Error('A valid email is required');
      const hi = Number(editHandicap);

      const result = await updateTournamentPlayer(
        playerId,
        {
          display_name: displayName,
          email: emailValue,
          handicap_index: Number.isFinite(hi) ? hi : null,
        },
        { tournamentId, accessToken }
      );
      return requireData(result, 'Could not update participant');
    },
    onSuccess: () => {
      cancelEditing();
      refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => Alert.alert('Could not update', error.message),
  });

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <View className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-3 mb-4">
        <Text className="text-neutral-300 text-sm">
          Step 1: Build the event participant list with name and email. Assign teams and matches
          later. No emails are sent from this tab.
        </Text>
      </View>

      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">Add participant</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Full name"
        placeholderTextColor="#525252"
        className={cn(inputClassName, 'mb-2')}
        style={inputStyle}
      />
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#525252"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        className={cn(inputClassName, 'mb-2')}
        style={inputStyle}
      />
      <TextInput
        value={handicap}
        onChangeText={setHandicap}
        placeholder="Handicap index (optional)"
        placeholderTextColor="#525252"
        keyboardType="decimal-pad"
        className={cn(inputClassName, 'mb-3')}
        style={inputStyle}
      />
      <Pressable
        onPress={webPressHandler(() => addMutation.mutate())}
        disabled={addMutation.isPending || !name.trim() || !email.trim()}
        className="flex-row items-center justify-center bg-lime-600 rounded-xl py-3 mb-6 active:opacity-80"
      >
        {addMutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Plus size={18} color="#fff" />
            <Text className="text-white font-bold ml-2">Add to participant list</Text>
          </>
        )}
      </Pressable>

      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
        Or add existing club member
      </Text>
      <View className="mb-6">
        {members.map((member) => {
          const added = participants.some((p) => p.user_id === member.id);
          return (
            <Pressable
              key={member.id}
              onPress={() => addMemberMutation.mutate(member)}
              disabled={added || addMemberMutation.isPending}
              className={cn(
                'flex-row items-center justify-between px-4 py-3 rounded-xl mb-2 border',
                added
                  ? 'bg-neutral-900 border-neutral-800 opacity-50'
                  : 'bg-[#0c0c0c] border-neutral-800 active:opacity-80'
              )}
            >
              <Text className="text-white font-medium">{member.full_name}</Text>
              <Text className="text-neutral-500 text-sm">
                {added ? 'Added' : (member.email ?? 'No email')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
        Participant list ({participants.length})
      </Text>
      {participants.length === 0 ? (
        <Text className="text-neutral-500 text-sm">No participants yet.</Text>
      ) : (
        participants.map((player) => {
          const team = getTeamForPlayer(player, teams);
          const resolvedEmail = resolveParticipantEmail(player, memberEmailByUserId);
          const isEditing = editingPlayerId === player.id;
          const isSaving = updateMutation.isPending && updateMutation.variables === player.id;

          if (isEditing) {
            return (
              <View
                key={player.id}
                className="bg-[#141414] border border-lime-600/40 rounded-xl px-4 py-3 mb-2"
              >
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Full name"
                  placeholderTextColor="#525252"
                  className={cn(inputClassName, 'mb-2')}
                  style={inputStyle}
                  autoFocus
                />
                <TextInput
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="Email"
                  placeholderTextColor="#525252"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className={cn(inputClassName, 'mb-2')}
                  style={inputStyle}
                />
                <TextInput
                  value={editHandicap}
                  onChangeText={setEditHandicap}
                  placeholder="Handicap index (optional)"
                  placeholderTextColor="#525252"
                  keyboardType="decimal-pad"
                  className={cn(inputClassName, 'mb-3')}
                  style={inputStyle}
                />
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={webPressHandler(() => updateMutation.mutate(player.id))}
                    disabled={isSaving || !editName.trim() || !editEmail.trim()}
                    className="flex-1 flex-row items-center justify-center bg-lime-600 rounded-xl py-2.5 active:opacity-80"
                  >
                    {isSaving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Check size={16} color="#fff" />
                        <Text className="text-white font-semibold ml-1.5">Save</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={webPressHandler(cancelEditing)}
                    disabled={isSaving}
                    className="flex-row items-center justify-center px-4 rounded-xl py-2.5 bg-neutral-900 border border-neutral-800 active:opacity-80"
                  >
                    <X size={16} color="#a3a3a3" />
                    <Text className="text-neutral-400 font-semibold ml-1.5">Cancel</Text>
                  </Pressable>
                </View>
              </View>
            );
          }

          return (
            <View
              key={player.id}
              className="flex-row items-center justify-between bg-[#141414] border border-neutral-800 rounded-xl px-4 py-3 mb-2"
            >
              <View className="flex-1 pr-3">
                <Text className="text-white font-medium">{player.display_name}</Text>
                <Text className="text-neutral-500 text-xs mt-0.5">
                  {resolvedEmail ?? 'No email'}
                  {player.handicap_index != null ? ` · ${player.handicap_index} HI` : ''}
                </Text>
                <Text className="text-neutral-600 text-[10px] mt-1">
                  {team ? `Team: ${team.team_name}` : 'Unassigned'}
                  {player.invite_email_sent_at ? ' · Invited' : ''}
                </Text>
              </View>
              <View className="flex-row gap-1">
                <Pressable
                  onPress={webPressHandler(() => startEditing(player))}
                  disabled={editingPlayerId != null}
                  className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 active:opacity-80"
                  accessibilityLabel={`Edit ${player.display_name}`}
                >
                  <Pencil size={16} color="#a3e635" />
                </Pressable>
                <Pressable
                  onPress={webPressHandler(() => handleDelete(player))}
                  disabled={deleteMutation.isPending && deleteMutation.variables === player.id}
                  className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 active:opacity-80"
                  accessibilityLabel={`Remove ${player.display_name}`}
                >
                  {deleteMutation.isPending && deleteMutation.variables === player.id ? (
                    <ActivityIndicator size="small" color="#737373" />
                  ) : (
                    <Trash2 size={16} color="#f87171" />
                  )}
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
