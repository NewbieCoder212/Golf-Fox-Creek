import { View, Text, Pressable, ScrollView } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import type { TournamentFormat } from '@/types';
import type { TournamentStorePlayer } from '@/lib/tournament-store';
import { getStrokesOnHole } from '@/lib/tournament-scoring';
import { FOX_CREEK_DATA } from '@/lib/course-data';
import { cn } from '@/lib/cn';

interface TournamentScorecardGridProps {
  format: TournamentFormat;
  players: TournamentStorePlayer[];
  currentHole: number;
  grossScores: Record<string, Record<number, number>>;
  teamGrossScores: Record<number, number>;
  computedScores: Array<{ hole: number; par: number; gross: number; net: number }>;
  playerDetails: Record<
    string,
    Array<{ hole: number; gross: number; net: number; strokes: number; isBestBall?: boolean }> | null
  >;
  onSelectHole: (hole: number) => void;
  onPlayerGrossChange: (playerId: string, hole: number, gross: number) => void;
  onTeamGrossChange: (hole: number, gross: number) => void;
}

function scoreColor(gross: number, par: number): string {
  const diff = gross - par;
  if (diff < 0) return 'text-lime-400';
  if (diff === 0) return 'text-white';
  return 'text-red-400';
}

export function TournamentScorecardGrid({
  format,
  players,
  currentHole,
  grossScores,
  teamGrossScores,
  computedScores,
  playerDetails,
  onSelectHole,
  onPlayerGrossChange,
  onTeamGrossChange,
}: TournamentScorecardGridProps) {
  const isTeamFormat = format === 'scramble' || format === 'alternate_shot';
  const isBestBall = format === 'best_ball';
  const isSingles = format === 'singles';

  const adjustGross = (
    playerId: string | null,
    hole: number,
    par: number,
    delta: number
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isTeamFormat) {
      const current = teamGrossScores[hole] ?? par;
      onTeamGrossChange(hole, Math.max(1, current + delta));
      return;
    }
    if (!playerId) return;
    const current = grossScores[playerId]?.[hole] ?? par;
    onPlayerGrossChange(playerId, hole, Math.max(1, current + delta));
  };

  return (
    <View className="mx-5 mt-4">
      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">
        Digital Scorecard
      </Text>

      <View className="bg-[#141414] rounded-2xl border border-neutral-800 overflow-hidden">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View className="flex-row bg-[#1a1a1a] border-b border-neutral-800">
              <View className="w-12 py-3 items-center border-r border-neutral-800">
                <Text className="text-neutral-500 text-xs font-medium">#</Text>
              </View>
              <View className="w-10 py-3 items-center border-r border-neutral-800">
                <Text className="text-neutral-500 text-xs font-medium">Par</Text>
              </View>
              {isTeamFormat ? (
                <View className="w-20 py-3 items-center border-r border-neutral-800">
                  <Text className="text-lime-400 text-xs font-bold">Team</Text>
                </View>
              ) : (
                players.map((player) => (
                  <View
                    key={player.id}
                    className="w-20 py-3 items-center border-r border-neutral-800"
                  >
                    <Text className="text-lime-400 text-xs font-bold" numberOfLines={1}>
                      {player.name.split(' ')[0]}
                    </Text>
                    <Text className="text-neutral-600 text-[10px]">
                      {player.playingHandicap} hcp
                    </Text>
                  </View>
                ))
              )}
              <View className="w-16 py-3 items-center">
                <Text className="text-neutral-500 text-xs font-medium">Net</Text>
              </View>
            </View>

            {FOX_CREEK_DATA.holeData.map((hole) => {
              const computed = computedScores.find((s) => s.hole === hole.holeNumber);
              const isActive = currentHole === hole.holeNumber;

              return (
                <Pressable
                  key={hole.holeNumber}
                  onPress={() => onSelectHole(hole.holeNumber)}
                  className={cn(
                    'flex-row border-b border-neutral-800/50',
                    isActive && 'bg-lime-400/5'
                  )}
                >
                  <View
                    className={cn(
                      'w-12 py-2.5 items-center justify-center border-r border-neutral-800/50',
                      isActive && 'bg-lime-400/10'
                    )}
                  >
                    <Text
                      className={cn(
                        'font-bold',
                        isActive ? 'text-lime-400' : 'text-white'
                      )}
                    >
                      {hole.holeNumber}
                    </Text>
                  </View>
                  <View className="w-10 py-2.5 items-center justify-center border-r border-neutral-800/50">
                    <Text className="text-neutral-500 text-sm">{hole.par}</Text>
                  </View>

                  {isTeamFormat ? (
                    <TeamScoreCell
                      gross={teamGrossScores[hole.holeNumber] ?? hole.par}
                      par={hole.par}
                      onDecrement={() =>
                        adjustGross(null, hole.holeNumber, hole.par, -1)
                      }
                      onIncrement={() =>
                        adjustGross(null, hole.holeNumber, hole.par, 1)
                      }
                    />
                  ) : (
                    players.map((player) => {
                      const gross =
                        grossScores[player.id]?.[hole.holeNumber] ?? hole.par;
                      const detail = playerDetails[player.id]?.find(
                        (d) => d.hole === hole.holeNumber
                      );
                      const strokes =
                        detail?.strokes ??
                        getStrokesOnHole(
                          player.playingHandicap,
                          hole.handicapIndex
                        );
                      const net = detail?.net ?? gross - strokes;
                      const isBest = isBestBall && detail?.isBestBall;

                      return (
                        <View
                          key={player.id}
                          className={cn(
                            'w-20 py-1.5 items-center border-r border-neutral-800/50',
                            isBest && 'bg-lime-900/20'
                          )}
                        >
                          <View className="flex-row items-center gap-1">
                            <Pressable
                              onPress={() =>
                                adjustGross(player.id, hole.holeNumber, hole.par, -1)
                              }
                              className="w-6 h-6 rounded bg-neutral-800 items-center justify-center"
                            >
                              <Minus size={10} color="#a3e635" />
                            </Pressable>
                            <View className="items-center min-w-[28px]">
                              <Text
                                className={cn(
                                  'font-bold text-sm',
                                  scoreColor(gross, hole.par)
                                )}
                              >
                                {gross}
                              </Text>
                              <Text className="text-neutral-600 text-[9px]">n{net}</Text>
                            </View>
                            <Pressable
                              onPress={() =>
                                adjustGross(player.id, hole.holeNumber, hole.par, 1)
                              }
                              className="w-6 h-6 rounded bg-neutral-800 items-center justify-center"
                            >
                              <Plus size={10} color="#a3e635" />
                            </Pressable>
                          </View>
                          {strokes > 0 && (
                            <Text className="text-lime-700 text-[9px] mt-0.5">
                              +{strokes}
                            </Text>
                          )}
                        </View>
                      );
                    })
                  )}

                  <View className="w-16 py-2.5 items-center justify-center">
                    <Text className="text-lime-400 font-bold text-sm">
                      {computed?.net ?? '–'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {isSingles && players[0] && (
        <Text className="text-neutral-600 text-xs mt-2 text-center">
          100% handicap allowance · Playing off {players[0].playingHandicap}
        </Text>
      )}
      {isBestBall && (
        <Text className="text-neutral-600 text-xs mt-2 text-center">
          85% handicap allowance · Highlighted = counted best ball
        </Text>
      )}
    </View>
  );
}

function TeamScoreCell({
  gross,
  par,
  onDecrement,
  onIncrement,
}: {
  gross: number;
  par: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View className="w-20 py-1.5 items-center border-r border-neutral-800/50">
      <View className="flex-row items-center gap-1">
        <Pressable
          onPress={onDecrement}
          className="w-6 h-6 rounded bg-neutral-800 items-center justify-center"
        >
          <Minus size={10} color="#a3e635" />
        </Pressable>
        <Text className={cn('font-bold text-sm min-w-[28px] text-center', scoreColor(gross, par))}>
          {gross}
        </Text>
        <Pressable
          onPress={onIncrement}
          className="w-6 h-6 rounded bg-neutral-800 items-center justify-center"
        >
          <Plus size={10} color="#a3e635" />
        </Pressable>
      </View>
    </View>
  );
}
