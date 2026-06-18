import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

import type { TournamentMatchHoleWinner } from '@/types';
import { cn } from '@/lib/cn';
import { SIDE_A_COLOR, SIDE_B_COLOR } from '@/lib/match-play-theme';

export interface DirectResultPlayer {
  id: string;
  name: string;
}

interface DirectResultToggleProps {
  sideAName: string;
  sideBName: string;
  sideAPlayers: DirectResultPlayer[];
  sideBPlayers: DirectResultPlayer[];
  currentOutcome: TournamentMatchHoleWinner | null;
  disabled?: boolean;
  onSelect: (winner: TournamentMatchHoleWinner) => void;
}

function TeamBadges({
  teamName,
  players,
  color,
}: {
  teamName: string;
  players: DirectResultPlayer[];
  color: string;
}) {
  return (
    <View className="flex-1 items-center">
      <Text style={{ color }} className="text-sm font-bold uppercase tracking-wide mb-1 text-center">
        {teamName}
      </Text>
      {players.map((p) => (
        <View
          key={p.id}
          className="px-2 py-0.5 rounded-full bg-neutral-800/80 border border-neutral-700 mb-1"
        >
          <Text className="text-neutral-200 text-[11px] font-medium">{p.name}</Text>
        </View>
      ))}
    </View>
  );
}

export function DirectResultToggle({
  sideAName,
  sideBName,
  sideAPlayers,
  sideBPlayers,
  currentOutcome,
  disabled = false,
  onSelect,
}: DirectResultToggleProps) {
  const handleSelect = (winner: TournamentMatchHoleWinner) => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(winner);
  };

  return (
    <View className={cn('mx-4', disabled && 'opacity-40')}>
      <View className="flex-row mb-3 gap-3">
        <TeamBadges teamName={sideAName} players={sideAPlayers} color={SIDE_A_COLOR} />
        <TeamBadges teamName={sideBName} players={sideBPlayers} color={SIDE_B_COLOR} />
      </View>

      <View className="flex-row gap-2">
        <Pressable
          onPress={() => handleSelect('side_a')}
          disabled={disabled}
          className={cn(
            'flex-1 py-4 rounded-xl border-2 items-center active:opacity-80',
            currentOutcome === 'side_a'
              ? 'bg-red-600/30 border-red-500'
              : 'bg-[#1a1a1a] border-neutral-700'
          )}
        >
          <Text className="text-red-400 font-bold text-sm">+1 {sideAName}</Text>
        </Pressable>

        <Pressable
          onPress={() => handleSelect('tie')}
          disabled={disabled}
          className={cn(
            'flex-1 py-4 rounded-xl border-2 items-center active:opacity-80',
            currentOutcome === 'tie'
              ? 'bg-neutral-600/40 border-neutral-400'
              : 'bg-[#1a1a1a] border-neutral-700'
          )}
        >
          <Text className="text-neutral-300 font-bold text-sm">Halved</Text>
        </Pressable>

        <Pressable
          onPress={() => handleSelect('side_b')}
          disabled={disabled}
          className={cn(
            'flex-1 py-4 rounded-xl border-2 items-center active:opacity-80',
            currentOutcome === 'side_b'
              ? 'bg-blue-600/30 border-blue-500'
              : 'bg-[#1a1a1a] border-neutral-700'
          )}
        >
          <Text className="text-blue-400 font-bold text-sm">+1 {sideBName}</Text>
        </Pressable>
      </View>
    </View>
  );
}
