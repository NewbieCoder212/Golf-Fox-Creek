import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

import type { TournamentMatchHoleWinner } from '@/types';
import type { MatchStatus } from '@/lib/tournament-match-status';
import { isHoleLocked } from '@/lib/tournament-match-status';
import { getHoleCellStyle } from '@/lib/match-play-theme';
import { FOX_CREEK_DATA } from '@/lib/course-data';
import { cn } from '@/lib/cn';

interface MatchPlayHoleGridProps {
  outcomes: Record<number, TournamentMatchHoleWinner | null>;
  currentHole: number;
  matchStatus: MatchStatus;
  onSelectHole: (hole: number) => void;
  title?: string;
}

export function MatchPlayHoleGrid({
  outcomes,
  currentHole,
  matchStatus,
  onSelectHole,
  title = 'Match Card',
}: MatchPlayHoleGridProps) {
  const frontNine = FOX_CREEK_DATA.holeData.slice(0, 9);
  const backNine = FOX_CREEK_DATA.holeData.slice(9, 18);

  const renderHole = (hole: number, par: number) => {
    const winner = outcomes[hole] ?? null;
    const locked = isHoleLocked(hole, matchStatus);
    const isCurrent = hole === currentHole;
    const cellStyle = getHoleCellStyle(winner, locked);

    return (
      <Pressable
        key={hole}
        onPress={() => {
          if (locked) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSelectHole(hole);
        }}
        disabled={locked}
        className={cn(
          'w-9 h-9 rounded-md items-center justify-center border',
          isCurrent ? 'border-amber-400 border-2' : 'border-neutral-700/50',
          locked && 'opacity-40'
        )}
        style={{ backgroundColor: cellStyle.backgroundColor, opacity: cellStyle.opacity }}
      >
        <Text className="text-white text-[10px] font-bold">{hole}</Text>
        <Text className="text-white/60 text-[8px]">{par}</Text>
      </Pressable>
    );
  };

  const renderNine = (holes: typeof frontNine, label: string) => (
    <View className="mb-3">
      <Text className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-1.5">
        {holes.map((h) => renderHole(h.holeNumber, h.par))}
      </View>
    </View>
  );

  return (
    <View className="mx-4 mt-4 mb-2">
      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">
        {title}
      </Text>
      <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-4">
        {renderNine(frontNine, 'Front 9')}
        {renderNine(backNine, 'Back 9')}

        <View className="flex-row justify-center gap-4 mt-2 pt-3 border-t border-neutral-800">
          <View className="flex-row items-center gap-1.5">
            <View className="w-3 h-3 rounded-sm bg-red-600" />
            <Text className="text-neutral-500 text-[10px]">Win</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="w-3 h-3 rounded-sm bg-neutral-600" />
            <Text className="text-neutral-500 text-[10px]">Halved</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="w-3 h-3 rounded-sm bg-blue-600" />
            <Text className="text-neutral-500 text-[10px]">Win</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
