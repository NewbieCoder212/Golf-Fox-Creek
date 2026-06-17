import { View, Text, Pressable } from 'react-native';

import { formatRoundPickerLabel } from '@/lib/tournament-labels';
import type { Tournament } from '@/types';
import { cn } from '@/lib/cn';

interface TournamentScorecardToolbarProps {
  tournament: Tournament;
  roundNumber: number;
  isDirty: boolean;
  teeTimeLabel?: string | null;
  matchStatusLabel?: string | null;
  onRoundChange: (round: number) => void;
}

export function TournamentScorecardToolbar({
  tournament,
  roundNumber,
  isDirty,
  teeTimeLabel,
  matchStatusLabel,
  onRoundChange,
}: TournamentScorecardToolbarProps) {
  return (
    <View className="px-4 pb-3 border-b border-neutral-800/50">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-white text-sm font-semibold" numberOfLines={1}>
            {tournament.name}
          </Text>
          <Text className="text-neutral-500 text-xs">
            {formatRoundPickerLabel(tournament, roundNumber)} · Tournament
            {teeTimeLabel ? ` · Tee ${teeTimeLabel}` : ''}
          </Text>
        </View>
        {matchStatusLabel ? (
          <View className="bg-lime-900/40 rounded-full px-2.5 py-1 mr-2">
            <Text className="text-lime-300 text-[10px] font-bold">{matchStatusLabel}</Text>
          </View>
        ) : null}
        {isDirty ? (
          <View className="bg-amber-900/40 rounded-full px-2 py-1">
            <Text className="text-amber-300 text-[10px] font-semibold">UNSYNCED</Text>
          </View>
        ) : null}
      </View>

      <Text className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2">Round</Text>
      <View className="flex-row gap-2 flex-wrap">
        {Array.from({ length: tournament.rounds_count }, (_, i) => i + 1).map((n) => (
          <Pressable
            key={n}
            onPress={() => onRoundChange(n)}
            className={cn(
              'px-3 py-2 rounded-lg border min-w-[64px] items-center',
              roundNumber === n
                ? 'bg-lime-900/40 border-lime-600'
                : 'bg-[#141414] border-neutral-800'
            )}
          >
            <Text
              className={cn(
                'font-semibold text-xs',
                roundNumber === n ? 'text-lime-400' : 'text-neutral-500'
              )}
            >
              {formatRoundPickerLabel(tournament, n)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
