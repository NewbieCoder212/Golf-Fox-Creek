import { useMemo } from 'react';
import { View, Text } from 'react-native';

import { TournamentMatchGridCard } from '@/components/TournamentMatchGridCard';
import type { MatchGridCardVariant } from '@/components/TournamentMatchGridCard';
import {
  buildMatchGridModels,
  groupMatchGridsByRound,
} from '@/lib/tournament-match-grid';
import { cn } from '@/lib/cn';
import type { TournamentMatchGroup, TournamentScore } from '@/types';

interface TournamentLiveMatchGridsProps {
  matchGroups: TournamentMatchGroup[];
  scores: TournamentScore[];
  teamNameById: Record<string, string>;
  playerNameById: Record<string, string>;
  useNetScoring: boolean;
  variant?: MatchGridCardVariant;
  roundNumber?: number;
  hideTitle?: boolean;
  layout?: 'stack' | 'tv-row';
}

export function TournamentLiveMatchGrids({
  matchGroups,
  scores,
  teamNameById,
  playerNameById,
  useNetScoring,
  variant = 'default',
  roundNumber,
  hideTitle = false,
  layout = 'stack',
}: TournamentLiveMatchGridsProps) {
  const filteredGroups = useMemo(
    () =>
      roundNumber != null
        ? matchGroups.filter((group) => group.round_number === roundNumber)
        : matchGroups,
    [matchGroups, roundNumber]
  );

  const filteredScores = useMemo(
    () =>
      roundNumber != null
        ? scores.filter((score) => score.round_number === roundNumber)
        : scores,
    [scores, roundNumber]
  );

  const models = useMemo(
    () =>
      buildMatchGridModels({
        matchGroups: filteredGroups,
        allScores: filteredScores,
        teamNameById,
        playerNameById,
        useNetScoring,
      }),
    [filteredGroups, filteredScores, teamNameById, playerNameById, useNetScoring]
  );

  const rounds = useMemo(() => groupMatchGridsByRound(models), [models]);
  const isTvRow = layout === 'tv-row';

  if (filteredGroups.length === 0) {
    return (
      <View
        className={cn(
          'items-center justify-center bg-[#141414] rounded-xl border border-neutral-800',
          isTvRow ? 'flex-1 py-6' : 'py-8 mb-3'
        )}
      >
        <Text className="text-neutral-500 text-sm">
          {roundNumber != null ? `No matches for round ${roundNumber}` : 'No match pairings yet'}
        </Text>
      </View>
    );
  }

  const matches = rounds.flatMap((round) => round.matches);

  if (isTvRow) {
    return (
      <View className="flex-1 flex-row gap-2 min-h-0">
        {matches.map((model) => (
          <View key={model.matchGroupId} className="flex-1 min-w-0">
            <TournamentMatchGridCard
              model={model}
              variant={variant}
              highlight={model.inProgress}
              fillHeight
            />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="mb-3">
      {!hideTitle ? (
        <Text
          className={cn(
            'text-neutral-500 uppercase tracking-widest mb-3',
            variant === 'tv' || variant === 'tv-compact' ? 'text-sm' : 'text-xs'
          )}
        >
          Match Scorecards
        </Text>
      ) : null}
      {rounds.map(({ roundNumber: round, matches: roundMatches }) => (
        <View key={`round-${round}`} className="mb-2">
          {rounds.length > 1 ? (
            <Text
              className={cn(
                'text-neutral-400 font-semibold mb-2 ml-1',
                variant === 'tv' || variant === 'tv-compact' ? 'text-sm' : 'text-xs'
              )}
            >
              Round {round}
            </Text>
          ) : null}
          {roundMatches.map((model) => (
            <TournamentMatchGridCard
              key={model.matchGroupId}
              model={model}
              variant={variant}
              highlight={model.inProgress}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
