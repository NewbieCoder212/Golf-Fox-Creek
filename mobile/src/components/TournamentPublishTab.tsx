import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sendParticipantInvites } from '@/lib/tournament-team-service';
import {
  countTeamsWithResolvedPlayers,
  getAssignedPlayerIds,
  resolveParticipantEmail,
} from '@/lib/tournament-participant-utils';
import { useTournamentMatchGroupsQuery } from '@/hooks/useTournamentMatchGroupsQuery';
import { formatRoundPickerLabel } from '@/lib/tournament-labels';
import type { Tournament, TournamentPlayer, TournamentTeam } from '@/types';
import { webPressHandler } from '@/lib/web-press';

interface TournamentPublishTabProps {
  tournamentId: string;
  tournament: Tournament;
  participants: TournamentPlayer[];
  teams: TournamentTeam[];
  members: Array<{ id: string; email?: string | null }>;
  accessToken: string;
}

export function TournamentPublishTab({
  tournamentId,
  tournament,
  participants,
  teams,
  members,
  accessToken,
}: TournamentPublishTabProps) {
  const queryClient = useQueryClient();
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number } | null>(
    null
  );

  const { data: matchGroups = [] } = useTournamentMatchGroupsQuery(tournamentId);

  const memberEmailByUserId = Object.fromEntries(
    members.filter((m) => m.email).map((m) => [m.id, m.email as string])
  );

  const withEmail = participants.filter((p) =>
    Boolean(resolveParticipantEmail(p, memberEmailByUserId))
  );
  const assignedCount = getAssignedPlayerIds(teams, participants).size;
  const teamsWithPlayers = countTeamsWithResolvedPlayers(teams, participants);
  const alreadyInvited = participants.filter((p) => p.invite_email_sent_at).length;

  const pairingsByRound = Array.from({ length: tournament.rounds_count }, (_, index) => {
    const roundNumber = index + 1;
    const savedGroups = matchGroups.filter((group) => group.round_number === roundNumber);
    const completeGroups = savedGroups.filter(
      (group) =>
        group.side_a_player_ids.length > 0 &&
        group.side_b_player_ids.length > 0 &&
        Boolean(group.tee_time)
    );
    return {
      roundNumber,
      label: formatRoundPickerLabel(tournament, roundNumber),
      ok: completeGroups.length > 0,
      count: completeGroups.length,
    };
  });

  const allRoundsHavePairings =
    tournament.rounds_count > 0 && pairingsByRound.every((round) => round.ok);

  const pendingInviteIds = participants
    .filter((p) => !p.invite_email_sent_at && resolveParticipantEmail(p, memberEmailByUserId))
    .map((p) => p.id);

  const sendMutation = useMutation({
    mutationFn: async () => {
      setBulkProgress({ completed: 0, total: pendingInviteIds.length });
      const result = await sendParticipantInvites({
        tournamentId,
        accessToken,
        playerIds: pendingInviteIds,
        onProgress: (progress) => setBulkProgress(progress),
      });
      if (!result.success) {
        throw new Error(result.error ?? 'Could not send invites');
      }
      return result;
    },
    onSuccess: (result) => {
      setBulkProgress(null);
      void queryClient.refetchQueries({ queryKey: ['tournament', tournamentId] });
      void queryClient.refetchQueries({ queryKey: ['tournamentPlayers', tournamentId] });
      void queryClient.refetchQueries({ queryKey: ['tournamentTeams', tournamentId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const errorNote =
        result.errors && result.errors.length > 0
          ? `\n\nSome issues:\n${result.errors.slice(0, 3).join('\n')}`
          : '';

      Alert.alert(
        'Invites sent',
        `Emailed ${result.emailed ?? 0} participant(s). Auth invites: ${result.invitesSent ?? 0}. Skipped (no email): ${result.skippedNoEmail ?? 0}.${errorNote}`
      );
    },
    onError: (error: Error) => {
      setBulkProgress(null);
      void queryClient.refetchQueries({ queryKey: ['tournamentPlayers', tournamentId] });
      Alert.alert('Could not send invites', error.message);
    },
  });

  const confirmSend = () => {
    Alert.alert(
      'Send login emails?',
      `This will email ${withEmail.length - alreadyInvited} participant(s) who have not been invited yet. Make sure teams and pairings are ready.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send emails',
          onPress: () => sendMutation.mutate(),
        },
      ]
    );
  };

  const checklist = [
    {
      ok: participants.length > 0,
      label: `${participants.length} participant(s) on the list`,
    },
    {
      ok: withEmail.length === participants.length && participants.length > 0,
      label: `${withEmail.length}/${participants.length} have an email address`,
    },
    {
      ok: teams.length >= 2,
      label: `${teams.length} team(s) created`,
    },
    {
      ok: assignedCount > 0,
      label: `${assignedCount} participant(s) assigned to teams`,
    },
    {
      ok: teamsWithPlayers >= Math.min(teams.length, 2),
      label: `${teamsWithPlayers} team(s) have at least one player`,
    },
    {
      ok: allRoundsHavePairings,
      label: allRoundsHavePairings
        ? `Match pairings saved for all ${tournament.rounds_count} round(s)`
        : `Match pairings saved for ${pairingsByRound.filter((r) => r.ok).length}/${tournament.rounds_count} round(s)`,
    },
    ...pairingsByRound.map((round) => ({
      ok: round.ok,
      label: round.ok
        ? `${round.label} — ${round.count} pairing(s)`
        : `${round.label} — no pairings saved yet`,
    })),
  ];

  const ready = checklist.every((item) => item.ok);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-3 mb-4">
        <Text className="text-neutral-300 text-sm">
          Step 4: When participants, teams, and matches are set up, send login emails. Nothing is
          emailed until you tap the button below.
        </Text>
      </View>

      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">Setup checklist</Text>
      {checklist.map((item) => (
        <View key={item.label} className="flex-row items-center mb-2">
          {item.ok ? (
            <CheckCircle2 size={16} color="#a3e635" />
          ) : (
            <AlertCircle size={16} color="#737373" />
          )}
          <Text className={item.ok ? 'text-neutral-300 text-sm ml-2' : 'text-neutral-500 text-sm ml-2'}>
            {item.label}
          </Text>
        </View>
      ))}

      {tournament.participant_invites_sent_at ? (
        <View className="bg-lime-900/20 border border-lime-700/40 rounded-xl px-4 py-3 mt-4 mb-4">
          <Text className="text-lime-400 text-sm font-semibold">Invites were sent</Text>
          <Text className="text-neutral-500 text-xs mt-1">
            Last send recorded for this event. Sending again only emails people not yet invited (
            {participants.length - alreadyInvited} remaining).
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={webPressHandler(confirmSend)}
        disabled={sendMutation.isPending || withEmail.length === 0}
        className={`flex-row items-center justify-center rounded-xl py-4 mt-6 ${
          withEmail.length === 0 ? 'bg-neutral-800 opacity-50' : 'bg-lime-600 active:opacity-80'
        }`}
      >
        {sendMutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Mail size={18} color="#fff" />
            <Text className="text-white font-bold ml-2">Send login emails</Text>
          </>
        )}
      </Pressable>

      {bulkProgress && bulkProgress.total > 0 ? (
        <Text className="text-neutral-400 text-sm text-center mt-3">
          Sending {bulkProgress.completed} of {bulkProgress.total}…
        </Text>
      ) : null}

      {!ready ? (
        <Text className="text-neutral-600 text-xs text-center mt-3 px-4">
          You can still send emails if the checklist is incomplete, but finish setup first for the
          best member experience.
        </Text>
      ) : null}
    </ScrollView>
  );
}
