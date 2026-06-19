import { View, Text, Pressable, ActivityIndicator, Alert, type GestureResponderEvent } from 'react-native';
import { Gavel } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  clearTournamentMatchScoresViaBackend,
  declareMatchWinnerOverride,
} from '@/lib/tournament-score-sync-service';
import { hasRecordedMatchResult } from '@/lib/tournament-match-play-status';
import { confirmAction } from '@/lib/confirm-action';
import type { TournamentMatchGroup, TournamentTeamSide } from '@/types';
import { cn } from '@/lib/cn';

interface MatchWinnerOverrideActionsProps {
  tournamentId: string;
  matchGroup: TournamentMatchGroup;
  roundNumber: number;
  sideAName: string;
  sideBName: string;
}

function stopPressPropagation(event: GestureResponderEvent) {
  event.stopPropagation?.();
}

export function MatchWinnerOverrideActions({
  tournamentId,
  matchGroup,
  roundNumber,
  sideAName,
  sideBName,
}: MatchWinnerOverrideActionsProps) {
  const queryClient = useQueryClient();
  const hasResult = hasRecordedMatchResult(matchGroup);

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
    mutationFn: (winner: TournamentTeamSide | 'tie') =>
      declareMatchWinnerOverride({
        tournamentId,
        matchGroupId: matchGroup.id,
        roundNumber,
        winner,
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
      clearTournamentMatchScoresViaBackend({
        tournamentId,
        matchGroupId: matchGroup.id,
        roundNumber,
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

  const handleDeclare = async (winner: TournamentTeamSide | 'tie', label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const warning = hasResult
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
      'Remove declared points and hole results for this match?'
    );
    if (!confirmed) return;

    clearMutation.mutate();
  };

  return (
    <View className="mt-3 pt-3 border-t border-neutral-800">
      <View className="flex-row items-center mb-2">
        <Gavel size={14} color="#a3a3a3" />
        <Text className="text-neutral-400 text-xs uppercase tracking-widest ml-1.5">
          Admin override
        </Text>
      </View>
      <Text className="text-neutral-500 text-xs mb-2">
        Award cup points without hole-by-hole entry. This does not open the scorecard.
      </Text>

      {hasResult ? (
        <View className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 mb-2">
          <Text className="text-neutral-300 text-xs">
            Current: {sideAName} {matchGroup.match_points_a} – {matchGroup.match_points_b}{' '}
            {sideBName}
            {matchGroup.match_winner === 'tie'
              ? ' (halved)'
              : matchGroup.match_winner === 'side_a'
                ? ` (${sideAName} won)`
                : matchGroup.match_winner === 'side_b'
                  ? ` (${sideBName} won)`
                  : ''}
          </Text>
        </View>
      ) : null}

      <View className="flex-row gap-2">
        <Pressable
          onPress={(event) => {
            stopPressPropagation(event);
            void handleDeclare('side_a', `${sideAName} wins (1 pt)`);
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
              {sideAName} wins (1 pt)
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
            void handleDeclare('side_b', `${sideBName} wins (1 pt)`);
          }}
          disabled={isPending}
          className={cn(
            'flex-1 items-center rounded-lg py-2.5 border border-lime-700/50 bg-lime-900/30 active:opacity-80',
            isPending && 'opacity-50'
          )}
        >
          <Text className="text-lime-400 font-semibold text-[11px] text-center">
            {sideBName} wins (1 pt)
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
