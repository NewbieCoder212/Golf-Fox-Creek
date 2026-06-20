import { View, Text, Pressable, ActivityIndicator, Alert, type GestureResponderEvent } from 'react-native';
import { Gavel } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  clearSinglesPairingResult,
  declareSinglesPairingWinnerOverride,
} from '@/lib/tournament-score-sync-service';
import { buildPairingMatchStatus } from '@/lib/tournament-pairing-status';
import { confirmAction } from '@/lib/confirm-action';
import type { TournamentFormat, TournamentMatchGroup, TournamentMatchHoleResult } from '@/types';
import { cn } from '@/lib/cn';

interface SinglesPairingOverrideActionsProps {
  tournamentId: string;
  matchGroup: TournamentMatchGroup;
  roundNumber: number;
  format: TournamentFormat;
  pairingIndex: number;
  playerAName: string;
  playerBName: string;
  holeResults: TournamentMatchHoleResult[];
}

function stopPressPropagation(event: GestureResponderEvent) {
  event.stopPropagation?.();
}

export function SinglesPairingOverrideActions({
  tournamentId,
  matchGroup,
  roundNumber,
  format,
  pairingIndex,
  playerAName,
  playerBName,
  holeResults,
}: SinglesPairingOverrideActionsProps) {
  const queryClient = useQueryClient();

  const groupHoleResults = holeResults.filter((row) => row.match_group_id === matchGroup.id);
  const pairingStatus = buildPairingMatchStatus(
    groupHoleResults,
    pairingIndex,
    playerAName,
    playerBName
  );
  const hasResult = pairingStatus.playStatus === 'complete';

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tournamentMatchGroups', tournamentId] }),
      queryClient.invalidateQueries({ queryKey: ['matchHoleResults'] }),
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] }),
      queryClient.invalidateQueries({ queryKey: ['tournamentDisplay'] }),
      queryClient.invalidateQueries({ queryKey: ['tournamentDisplaySlug'] }),
    ]);
  };

  const declareMutation = useMutation({
    mutationFn: (winner: 'side_a' | 'side_b' | 'tie') =>
      declareSinglesPairingWinnerOverride({
        tournamentId,
        matchGroup,
        roundNumber,
        pairingIndex,
        winner,
        format,
      }),
    onSuccess: async (result) => {
      if (!result.success) {
        Alert.alert('Could not save', result.error ?? 'Try again.');
        return;
      }
      await invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert('Could not save', error.message);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () =>
      clearSinglesPairingResult({
        tournamentId,
        matchGroup,
        roundNumber,
        pairingIndex,
        format,
      }),
    onSuccess: async (result) => {
      if (!result.success) {
        Alert.alert('Could not clear', result.error ?? 'Try again.');
        return;
      }
      await invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert('Could not clear', error.message);
    },
  });

  const isPending = declareMutation.isPending || clearMutation.isPending;

  const handleDeclare = async (winner: 'side_a' | 'side_b' | 'tie', label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const warning =
      groupHoleResults.some((row) => (row.pairing_index ?? 0) === pairingIndex)
        ? ' This replaces any hole-by-hole results already entered for this match.'
        : '';

    const confirmed = await confirmAction(
      'Declare match result',
      `Award cup points: ${label}.${warning}`
    );
    if (!confirmed) return;

    declareMutation.mutate(winner);
  };

  const handleClear = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const confirmed = await confirmAction(
      'Clear match result',
      `Remove declared points and hole results for ${playerAName} vs ${playerBName}?`
    );
    if (!confirmed) return;

    clearMutation.mutate();
  };

  return (
    <View className="mt-3 pt-3 border-t border-neutral-800">
      <Text className="text-neutral-300 text-xs font-semibold mb-2">
        Match {pairingIndex + 1} · {playerAName} vs {playerBName}
      </Text>

      <View className="flex-row items-center mb-2">
        <Gavel size={14} color="#a3a3a3" />
        <Text className="text-neutral-400 text-xs uppercase tracking-widest ml-1.5">
          Admin override
        </Text>
      </View>
      <Text className="text-neutral-500 text-xs mb-2">
        Award cup points without hole-by-hole entry. This does not open the scorecard.
      </Text>

      {hasResult && pairingStatus.resultSummary ? (
        <View className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 mb-2">
          <Text className="text-neutral-300 text-xs">Current: {pairingStatus.resultSummary}</Text>
        </View>
      ) : null}

      <View className="flex-row gap-2">
        <Pressable
          onPress={(event) => {
            stopPressPropagation(event);
            void handleDeclare('side_a', `${playerAName} wins (1 pt)`);
          }}
          disabled={isPending}
          className={cn(
            'flex-1 items-center rounded-lg py-2.5 border border-lime-700/50 bg-lime-900/30 active:opacity-80',
            isPending && 'opacity-50'
          )}
        >
          {declareMutation.isPending ? (
            <ActivityIndicator color="#a3e635" size="small" />
          ) : (
            <Text className="text-lime-400 font-semibold text-[11px] text-center">
              {playerAName} wins (1 pt)
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={(event) => {
            stopPressPropagation(event);
            void handleDeclare('tie', 'Match halved (0.5 pt each)');
          }}
          disabled={isPending}
          className={cn(
            'flex-1 items-center rounded-lg py-2.5 border border-neutral-600 bg-neutral-900 active:opacity-80',
            isPending && 'opacity-50'
          )}
        >
          <Text className="text-neutral-300 font-semibold text-[11px] text-center">
            Halved (0.5 pt)
          </Text>
        </Pressable>
        <Pressable
          onPress={(event) => {
            stopPressPropagation(event);
            void handleDeclare('side_b', `${playerBName} wins (1 pt)`);
          }}
          disabled={isPending}
          className={cn(
            'flex-1 items-center rounded-lg py-2.5 border border-lime-700/50 bg-lime-900/30 active:opacity-80',
            isPending && 'opacity-50'
          )}
        >
          <Text className="text-lime-400 font-semibold text-[11px] text-center">
            {playerBName} wins (1 pt)
          </Text>
        </Pressable>
      </View>

      {hasResult ? (
        <Pressable
          onPress={(event) => {
            stopPressPropagation(event);
            void handleClear();
          }}
          disabled={isPending}
          className={cn(
            'mt-2 items-center rounded-lg py-2 border border-neutral-700 active:opacity-80',
            isPending && 'opacity-50'
          )}
        >
          {clearMutation.isPending ? (
            <ActivityIndicator color="#737373" size="small" />
          ) : (
            <Text className="text-neutral-500 text-xs font-medium">Clear result</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
