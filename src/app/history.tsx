import { View, Text, ScrollView, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Trophy, Calendar, Clock, Flag, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useScorecardStore } from '@/lib/scorecard-store';
import { cn } from '@/lib/cn';

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins} min`;
};

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const roundHistory = useScorecardStore((s) => s.roundHistory);
  const loadRoundHistory = useScorecardStore((s) => s.loadRoundHistory);
  const deleteRound = useScorecardStore((s) => s.deleteRound);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadRoundHistory();
  }, []);

  const handleDeletePress = (roundId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteConfirmId(roundId);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await deleteRound(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleCancelDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDeleteConfirmId(null);
  };

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      {/* Header */}
      <View
        style={{ paddingTop: insets.top }}
        className="bg-[#141414] border-b border-neutral-800"
      >
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="flex-row items-center active:opacity-60 py-1"
          >
            <ChevronLeft size={24} color="#a3e635" />
            <Text className="text-lime-400 text-base font-medium ml-1">Back</Text>
          </Pressable>
          <Text className="text-white text-lg font-semibold ml-4">Round History</Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {roundHistory.length === 0 ? (
          /* Empty State */
          <Animated.View
            entering={FadeInDown.delay(100).duration(500)}
            className="flex-1 items-center justify-center px-8 pt-32"
          >
            <View className="w-24 h-24 bg-[#141414] rounded-full items-center justify-center mb-6 border border-neutral-800">
              <Trophy size={40} color="#525252" strokeWidth={1.5} />
            </View>
            <Text className="text-white text-xl font-bold text-center mb-2">
              No rounds recorded yet
            </Text>
            <Text className="text-neutral-500 text-center leading-relaxed">
              Hit the links! Your completed rounds will appear here.
            </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(tabs)/scorecard');
              }}
              className="bg-lime-400 rounded-xl py-3 px-6 mt-8 active:opacity-80"
            >
              <Text className="text-black font-bold">Start a Round</Text>
            </Pressable>
          </Animated.View>
        ) : (
          /* Round History List */
          <View className="px-5 pt-5">
            <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-4">
              {roundHistory.length} Round{roundHistory.length !== 1 ? 's' : ''} Played
            </Text>

            {roundHistory.map((round, index) => {
              // Calculate totals for first player (primary score)
              const totalScore = round.scores.reduce((sum, hole) => {
                const score = hole.scores[0];
                return sum + (score ?? 0);
              }, 0);

              const relativeToPar = totalScore - round.coursePar;

              return (
                <Animated.View
                  key={round.id}
                  entering={FadeInDown.delay(100 + index * 50).duration(400)}
                >
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      // Future: Could navigate to round details
                    }}
                    className="bg-[#141414] rounded-2xl border border-neutral-800 mb-3 overflow-hidden active:opacity-90"
                  >
                    {/* Date Header */}
                    <View className="flex-row items-center justify-between px-4 py-3 border-b border-neutral-800/50">
                      <View className="flex-row items-center">
                        <Calendar size={14} color="#737373" />
                        <Text className="text-neutral-400 text-sm ml-2">
                          {formatDate(round.date)}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Clock size={12} color="#525252" />
                        <Text className="text-neutral-600 text-xs ml-1 mr-3">
                          {formatTime(round.totalTime)}
                        </Text>
                        <Pressable
                          onPress={() => handleDeletePress(round.id)}
                          className="p-1 active:opacity-50"
                        >
                          <Trash2 size={16} color="#525252" />
                        </Pressable>
                      </View>
                    </View>

                    {/* Score Display */}
                    <View className="px-4 py-4">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <Flag size={16} color="#a3e635" />
                          <Text className="text-white font-medium ml-2">Fox Creek</Text>
                        </View>

                        <View className="flex-row items-center">
                          <View className="items-end mr-4">
                            <Text className="text-neutral-600 text-xs uppercase tracking-widest">Score</Text>
                            <Text className="text-white text-2xl font-bold">{totalScore}</Text>
                          </View>

                          <View className="items-end bg-neutral-900 rounded-xl px-3 py-2">
                            <Text className="text-neutral-600 text-xs uppercase tracking-widest">vs Par</Text>
                            <Text
                              className={cn(
                                'text-xl font-bold',
                                relativeToPar === 0
                                  ? 'text-white'
                                  : relativeToPar > 0
                                  ? 'text-red-400'
                                  : 'text-lime-400'
                              )}
                            >
                              {relativeToPar === 0 ? 'E' : relativeToPar > 0 ? `+${relativeToPar}` : relativeToPar}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Front 9 / Back 9 Mini Stats */}
                      <View className="flex-row mt-4 pt-3 border-t border-neutral-800/50">
                        <View className="flex-1 flex-row items-center">
                          <Text className="text-neutral-600 text-xs mr-2">Front 9:</Text>
                          <Text className="text-neutral-400 font-medium">
                            {round.scores.slice(0, 9).reduce((sum, h) => sum + (h.scores[0] ?? 0), 0) || '–'}
                          </Text>
                        </View>
                        <View className="flex-1 flex-row items-center justify-end">
                          <Text className="text-neutral-600 text-xs mr-2">Back 9:</Text>
                          <Text className="text-neutral-400 font-medium">
                            {round.scores.slice(9, 18).reduce((sum, h) => sum + (h.scores[0] ?? 0), 0) || '–'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Accent Line */}
                    <View
                      className={cn(
                        'h-1',
                        relativeToPar <= 0 ? 'bg-lime-400/30' : 'bg-red-400/30'
                      )}
                    />
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <Animated.View
          entering={FadeIn.duration(200)}
          className="absolute inset-0 bg-black/80 items-center justify-center"
        >
          <Pressable
            onPress={handleCancelDelete}
            className="absolute inset-0"
          />
          <View className="bg-[#1a1a1a] rounded-2xl border border-neutral-800 mx-8 w-full max-w-sm overflow-hidden">
            <View className="p-6 items-center">
              <View className="w-16 h-16 rounded-full bg-red-500/20 items-center justify-center mb-4">
                <Trash2 size={28} color="#ef4444" />
              </View>
              <Text className="text-white text-xl font-bold text-center mb-2">
                Delete Round?
              </Text>
              <Text className="text-neutral-400 text-center">
                This action cannot be undone.
              </Text>
            </View>
            <View className="flex-row border-t border-neutral-800">
              <Pressable
                onPress={handleCancelDelete}
                className="flex-1 py-4 items-center border-r border-neutral-800 active:bg-neutral-800"
              >
                <Text className="text-neutral-300 font-medium">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmDelete}
                className="flex-1 py-4 items-center active:bg-red-900/30"
              >
                <Text className="text-red-400 font-bold">Delete</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
