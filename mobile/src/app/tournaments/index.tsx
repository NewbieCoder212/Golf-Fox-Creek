import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Trophy, Plus, Calendar, X, Trash2 } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useMemberAuthStore } from '@/lib/member-auth-store';
import { useAdminAuthStore } from '@/lib/admin-auth-store';
import {
  createTournament,
  getTournamentsForUserList,
  getTournamentsResult,
} from '@/lib/tournament-service';
import { FORMAT_LABELS, formatTournamentDates } from '@/lib/tournament-labels';
import {
  buildSchedulePayload,
  createDefaultSchedule,
  getTotalRounds,
  MAX_TOURNAMENT_DAYS,
  MAX_TOURNAMENT_ROUNDS,
} from '@/lib/tournament-schedule';
import type { TournamentDaySchedule, TournamentFormat } from '@/types';
import { cn } from '@/lib/cn';

const FORMATS: TournamentFormat[] = ['scramble', 'best_ball', 'alternate_shot', 'singles'];

export default function TournamentsListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useMemberAuthStore((s) => s.profile);
  const user = useMemberAuthStore((s) => s.user);
  const canAccessAdmin = useAdminAuthStore((s) => s.canAccessAdmin);
  const isManager =
    profile?.role === 'manager' ||
    profile?.role === 'super_admin' ||
    canAccessAdmin();
  const viewAllTournaments = isManager;

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [schedule, setSchedule] = useState<TournamentDaySchedule[]>(createDefaultSchedule);

  const {
    data: tournaments = [],
    isLoading,
    refetch,
    isRefetching,
    error: listError,
  } = useQuery({
    queryKey: ['tournaments', user?.id, viewAllTournaments],
    queryFn: async () => {
      if (!user?.id) return [];
      if (viewAllTournaments) {
        const result = await getTournamentsResult({ limit: 30 });
        if (result.error) throw new Error(result.error);
        return result.data ?? [];
      }
      return getTournamentsForUserList(user.id, { limit: 30 });
    },
    enabled: Boolean(user?.id),
  });

  const createMutation = useMutation({
    mutationFn: createTournament,
    onSuccess: (result) => {
      if (result.error || !result.data) {
        Alert.alert('Could not create tournament', result.error ?? 'Unknown error');
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setShowCreate(false);
      setName('');
      setStartDate('');
      setEndDate('');
      setSchedule(createDefaultSchedule());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push(`/tournaments/${result.data.id}`);
    },
  });

  const handleCreate = () => {
    if (!name.trim() || !startDate || !endDate) return;

    createMutation.mutate({
      name: name.trim(),
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      ...buildSchedulePayload(schedule),
    });
  };

  const totalRounds = getTotalRounds(schedule);

  const addDay = () => {
    if (schedule.length >= MAX_TOURNAMENT_DAYS || totalRounds >= MAX_TOURNAMENT_ROUNDS) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSchedule((prev) => [...prev, { formats: ['scramble'] }]);
  };

  const removeDay = (dayIndex: number) => {
    if (schedule.length <= 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSchedule((prev) => prev.filter((_, index) => index !== dayIndex));
  };

  const addRoundToDay = (dayIndex: number) => {
    if (totalRounds >= MAX_TOURNAMENT_ROUNDS) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSchedule((prev) =>
      prev.map((day, index) =>
        index === dayIndex ? { formats: [...day.formats, 'scramble'] } : day
      )
    );
  };

  const removeRoundFromDay = (dayIndex: number, roundIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSchedule((prev) => {
      const day = prev[dayIndex];
      if (!day) return prev;

      if (day.formats.length > 1) {
        return prev.map((entry, index) =>
          index === dayIndex
            ? { formats: entry.formats.filter((_, i) => i !== roundIndex) }
            : entry
        );
      }

      if (prev.length > 1) {
        return prev.filter((_, index) => index !== dayIndex);
      }

      return prev;
    });
  };

  const setRoundFormat = (dayIndex: number, roundIndex: number, format: TournamentFormat) => {
    setSchedule((prev) =>
      prev.map((day, index) =>
        index === dayIndex
          ? {
              formats: day.formats.map((current, i) => (i === roundIndex ? format : current)),
            }
          : day
      )
    );
  };

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <View style={{ paddingTop: insets.top }} className="bg-[#141414] border-b border-neutral-800">
        <View className="flex-row items-center justify-between px-4 py-3">
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

          {isManager && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCreate(true);
              }}
              className="flex-row items-center bg-lime-600 rounded-full px-3 py-1.5 active:opacity-80"
            >
              <Plus size={16} color="#fff" />
              <Text className="text-white text-sm font-semibold ml-1">New</Text>
            </Pressable>
          )}
        </View>
        <View className="px-5 pb-4">
          <Text className="text-white text-2xl font-bold">Tournaments</Text>
          <Text className="text-neutral-500 text-sm mt-1">
            {viewAllTournaments
              ? 'All club events — create and manage tournaments'
              : 'Events you are registered for'}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#a3e635" />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {isLoading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color="#a3e635" />
          </View>
        ) : listError ? (
          <View className="mx-5 mt-8 items-center py-12 bg-[#141414] rounded-2xl border border-neutral-800">
            <Trophy size={40} color="#525252" />
            <Text className="text-white font-semibold mt-4">Could not load tournaments</Text>
            <Text className="text-neutral-500 text-sm text-center mt-2 px-8">
              {(listError as Error).message}
            </Text>
          </View>
        ) : tournaments.length === 0 ? (
          <View className="mx-5 mt-8 items-center py-12 bg-[#141414] rounded-2xl border border-neutral-800">
            <Trophy size={40} color="#525252" />
            <Text className="text-white font-semibold mt-4">
              {viewAllTournaments ? 'No tournaments yet' : 'No events yet'}
            </Text>
            <Text className="text-neutral-500 text-sm text-center mt-2 px-8">
              {viewAllTournaments
                ? 'Tap New to create a club tournament.'
                : 'When the pro shop adds you to a team or tee sheet, your events will appear here.'}
            </Text>
          </View>
        ) : (
          tournaments.map((tournament, index) => (
            <Animated.View
              key={tournament.id}
              entering={FadeInDown.delay(index * 60).duration(400)}
              className="mx-5 mt-4"
            >
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/tournaments/${tournament.id}`);
                }}
                className="bg-[#141414] rounded-2xl border border-neutral-800 p-4 active:opacity-80"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 mr-3">
                    <Text className="text-white text-lg font-bold">{tournament.name}</Text>
                    <View className="flex-row items-center mt-2">
                      <Calendar size={14} color="#737373" />
                      <Text className="text-neutral-400 text-sm ml-1.5">
                        {formatTournamentDates(tournament.start_date, tournament.end_date)}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#525252" />
                </View>

                <View className="flex-row flex-wrap gap-2 mt-3">
                  {tournament.round_schedule.map((day, dayIndex) => (
                    <View
                      key={`${tournament.id}-day-${dayIndex}`}
                      className="bg-lime-900/30 border border-lime-700/40 rounded-full px-3 py-1"
                    >
                      <Text className="text-lime-400 text-xs font-semibold">
                        Day {dayIndex + 1}:{' '}
                        {day.formats.map((format) => FORMAT_LABELS[format]).join(', ')}
                      </Text>
                    </View>
                  ))}
                  <View className="bg-neutral-800 rounded-full px-3 py-1">
                    <Text className="text-neutral-400 text-xs font-medium">
                      {tournament.rounds_count} rounds
                    </Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          ))
        )}
      </ScrollView>

      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#141414] rounded-t-3xl border-t border-neutral-800 px-5 pt-5 pb-10 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-white text-xl font-bold">Create Tournament</Text>
              <Pressable onPress={() => setShowCreate(false)} className="p-2">
                <X size={22} color="#737373" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[70%]">
            <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Member-Guest 2026"
              placeholderTextColor="#525252"
              className="bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white mb-4"
            />

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                  Start
                </Text>
                <TextInput
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#525252"
                  className="bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white"
                />
              </View>
              <View className="flex-1">
                <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">End</Text>
                <TextInput
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#525252"
                  className="bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white"
                />
              </View>
            </View>

            <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
              Schedule
            </Text>
            <Text className="text-neutral-600 text-xs mb-3">
              Add days and rounds. A day can have multiple rounds (e.g. AM scramble, PM singles).
            </Text>
            {schedule.map((day, dayIndex) => (
              <View
                key={dayIndex}
                className="mb-4 bg-[#0c0c0c] border border-neutral-800 rounded-xl p-3"
              >
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-white text-sm font-semibold">Day {dayIndex + 1}</Text>
                  {schedule.length > 1 && (
                    <Pressable
                      onPress={() => removeDay(dayIndex)}
                      className="flex-row items-center px-2 py-1 active:opacity-60"
                    >
                      <Trash2 size={14} color="#737373" />
                      <Text className="text-neutral-500 text-xs ml-1">Remove day</Text>
                    </Pressable>
                  )}
                </View>

                {day.formats.map((roundFormat, roundIndex) => (
                  <View key={roundIndex} className="mb-3 last:mb-0">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-neutral-400 text-xs font-medium uppercase tracking-wider">
                        {day.formats.length > 1 ? `Round ${roundIndex + 1}` : 'Format'}
                      </Text>
                      {(day.formats.length > 1 || schedule.length > 1) && (
                        <Pressable
                          onPress={() => removeRoundFromDay(dayIndex, roundIndex)}
                          className="px-2 py-1 active:opacity-60"
                        >
                          <Text className="text-neutral-500 text-xs">Remove</Text>
                        </Pressable>
                      )}
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      {FORMATS.map((f) => (
                        <Pressable
                          key={f}
                          onPress={() => setRoundFormat(dayIndex, roundIndex, f)}
                          className={cn(
                            'px-3 py-2 rounded-lg border',
                            roundFormat === f
                              ? 'bg-lime-900/40 border-lime-600'
                              : 'bg-[#141414] border-neutral-800'
                          )}
                        >
                          <Text
                            className={cn(
                              'text-xs font-medium',
                              roundFormat === f ? 'text-lime-400' : 'text-neutral-500'
                            )}
                          >
                            {FORMAT_LABELS[f]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}

                {totalRounds < MAX_TOURNAMENT_ROUNDS && (
                  <Pressable
                    onPress={() => addRoundToDay(dayIndex)}
                    className="flex-row items-center justify-center border border-dashed border-neutral-700 rounded-lg py-2 mt-1 active:opacity-80"
                  >
                    <Plus size={14} color="#a3e635" />
                    <Text className="text-lime-400 text-xs font-semibold ml-1.5">
                      Add round today
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}

            {schedule.length < MAX_TOURNAMENT_DAYS && totalRounds < MAX_TOURNAMENT_ROUNDS && (
              <Pressable
                onPress={addDay}
                className="flex-row items-center justify-center border border-dashed border-neutral-700 rounded-xl py-3 mb-4 active:opacity-80"
              >
                <Plus size={16} color="#a3e635" />
                <Text className="text-lime-400 font-semibold ml-2">Add Day</Text>
              </Pressable>
            )}
            </ScrollView>

            <Pressable
              onPress={handleCreate}
              disabled={createMutation.isPending}
              className="bg-lime-600 rounded-xl py-4 items-center active:opacity-80 mb-2"
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Create Tournament</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
