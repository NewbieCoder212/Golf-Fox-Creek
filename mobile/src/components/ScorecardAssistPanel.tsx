import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  AlertTriangle,
  Flag,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { cn } from '@/lib/cn';
import { MatchHoleAdBanners } from '@/components/MatchHoleAdBanners';

interface AssistPlayer {
  id: number;
  name: string;
  initials: string;
}

interface ScorecardAssistPanelProps {
  currentHole: number;
  holePar: number;
  elapsedSeconds: number;
  isOverTime: boolean;
  isWarning: boolean;
  isTracking: boolean;
  locationPermission: boolean;
  players: AssistPlayer[];
  holeScores: (number | null)[];
  onSetCurrentHole: (hole: number) => void;
  onScoreAdjust: (playerIndex: number, delta: number) => void;
  onTriggerHoleComplete: () => void;
  formatTime: (seconds: number) => string;
  getRelativeToPar: (playerIndex: number) => number;
  onDeleteRound?: () => void;
}

export function ScorecardAssistPanel({
  currentHole,
  holePar,
  elapsedSeconds,
  isOverTime,
  isWarning,
  isTracking,
  locationPermission,
  players,
  holeScores,
  onSetCurrentHole,
  onScoreAdjust,
  onTriggerHoleComplete,
  formatTime,
  getRelativeToPar,
  onDeleteRound,
}: ScorecardAssistPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="bg-[#1a1a1a] border-b border-neutral-800">
      <Pressable
        onPress={() => setExpanded(!expanded)}
        className="px-5 py-3 flex-row items-center justify-between active:opacity-80"
      >
        <View className="flex-row items-center flex-1">
          {isOverTime ? (
            <AlertTriangle size={16} color="#fff" />
          ) : (
            <Clock size={16} color={isWarning ? '#fef3c7' : '#a3e635'} />
          )}
          <Text
            className={cn(
              'ml-2 font-mono text-sm font-bold',
              isOverTime ? 'text-white' : isWarning ? 'text-amber-100' : 'text-lime-400'
            )}
          >
            {formatTime(elapsedSeconds)}
          </Text>
          <Text className="text-neutral-500 text-sm ml-4">
            Hole <Text className="text-white font-bold">{currentHole}</Text>/18
          </Text>
        </View>
        <View className="flex-row items-center">
          <MapPin size={14} color={locationPermission ? '#a3e635' : '#525252'} />
          <Text className="text-neutral-500 text-xs ml-1 mr-2">
            {locationPermission ? 'GPS' : 'GPS Off'}
          </Text>
          {expanded ? (
            <ChevronUp size={18} color="#737373" />
          ) : (
            <ChevronDown size={18} color="#737373" />
          )}
        </View>
      </Pressable>

      {isOverTime && !expanded ? (
        <View className="bg-red-900/50 px-5 py-1.5">
          <Text className="text-red-200 text-xs text-center font-medium">Pace alert — please pick up the pace</Text>
        </View>
      ) : null}

      {expanded ? (
        <Animated.View entering={FadeInDown.duration(200)} className="px-5 pb-4">
          {isOverTime ? (
            <View className="bg-red-900/40 rounded-lg px-3 py-2 mb-3">
              <Text className="text-red-200 text-xs text-center font-medium">
                Pace Alert: Please pick up the pace to maintain course flow
              </Text>
            </View>
          ) : null}

          <View className="bg-[#141414] rounded-xl border border-neutral-800 overflow-hidden mb-3">
            <View className="flex-row items-center justify-between p-3 border-b border-neutral-800">
              <Pressable
                onPress={() => currentHole > 1 && onSetCurrentHole(currentHole - 1)}
                disabled={currentHole === 1}
                className="p-2 active:opacity-50"
              >
                <ChevronLeft size={22} color={currentHole === 1 ? '#404040' : '#a3e635'} />
              </Pressable>
              <View className="items-center">
                <Text className="text-neutral-500 text-[10px] uppercase tracking-widest">Quick Entry</Text>
                <Text className="text-white text-2xl font-bold">Hole {currentHole}</Text>
                <Text className="text-lime-400 text-sm">Par {holePar}</Text>
              </View>
              <Pressable
                onPress={() => currentHole < 18 && onSetCurrentHole(currentHole + 1)}
                disabled={currentHole === 18}
                className="p-2 active:opacity-50"
              >
                <ChevronRight size={22} color={currentHole === 18 ? '#404040' : '#a3e635'} />
              </Pressable>
            </View>

            {players.map((player, index) => {
              const score = holeScores[index];
              const relativeToPar = getRelativeToPar(index);
              return (
                <View
                  key={player.id}
                  className={cn(
                    'flex-row items-center px-3 py-2.5',
                    index < players.length - 1 && 'border-b border-neutral-800/50'
                  )}
                >
                  <View className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center mr-2">
                    <Text className="text-lime-400 font-bold text-xs">{player.initials}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-medium text-sm">{player.name}</Text>
                    <Text
                      className={cn(
                        'text-[10px]',
                        relativeToPar === 0
                          ? 'text-neutral-500'
                          : relativeToPar > 0
                          ? 'text-red-400'
                          : 'text-lime-400'
                      )}
                    >
                      {relativeToPar === 0
                        ? 'E'
                        : relativeToPar > 0
                        ? `+${relativeToPar}`
                        : relativeToPar}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onScoreAdjust(index, -1);
                      }}
                      className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center"
                    >
                      <Text className="text-lime-400 text-lg font-bold">−</Text>
                    </Pressable>
                    <View className="w-10 items-center">
                      <Text
                        className={cn(
                          'text-xl font-bold',
                          score === null
                            ? 'text-neutral-600'
                            : score === holePar
                            ? 'text-white'
                            : score < holePar
                            ? 'text-lime-400'
                            : 'text-red-400'
                        )}
                      >
                        {score ?? '–'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onScoreAdjust(index, 1);
                      }}
                      className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center"
                    >
                      <Text className="text-lime-400 text-lg font-bold">+</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>

          <MatchHoleAdBanners holeNumber={currentHole} className="mb-3" />

          {isTracking ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onTriggerHoleComplete();
              }}
              className="flex-row items-center justify-center bg-neutral-800 rounded-xl py-3 active:opacity-70"
            >
              <Flag size={14} color="#a3e635" />
              <Text className="text-neutral-300 text-sm font-medium ml-2">
                Mark Hole Complete / Advance
              </Text>
            </Pressable>
          ) : null}

          {onDeleteRound ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDeleteRound();
              }}
              className="flex-row items-center justify-center border border-red-900/50 bg-red-950/30 rounded-xl py-3 mt-3 active:opacity-70"
            >
              <Trash2 size={14} color="#f87171" />
              <Text className="text-red-400 text-sm font-medium ml-2">Delete Round</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}
