import { View, Text, Pressable, TextInput } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import {
  buildSchedulePayload,
  createDefaultSchedule,
  getTotalRounds,
  MAX_TOURNAMENT_DAYS,
  MAX_TOURNAMENT_ROUNDS,
} from '@/lib/tournament-schedule';
import { formatLabel, PRESET_TOURNAMENT_FORMATS } from '@/lib/tournament-labels';
import type { TournamentDaySchedule, TournamentFormat } from '@/types';
import { cn } from '@/lib/cn';

const FORMATS = PRESET_TOURNAMENT_FORMATS;

interface TournamentScheduleEditorProps {
  schedule: TournamentDaySchedule[];
  onScheduleChange: (schedule: TournamentDaySchedule[]) => void;
  customFormatByKey?: Record<string, string>;
  onCustomFormatChange?: (key: string, value: string) => void;
  presetFormatIds?: string[];
}

function scheduleKey(dayIndex: number, roundIndex: number): string {
  return `${dayIndex}-${roundIndex}`;
}

export function createEmptySchedule(): TournamentDaySchedule[] {
  return createDefaultSchedule();
}

export { buildSchedulePayload };

export function TournamentScheduleEditor({
  schedule,
  onScheduleChange,
  customFormatByKey = {},
  onCustomFormatChange,
  presetFormatIds,
}: TournamentScheduleEditorProps) {
  const formatOptions = (
    presetFormatIds?.length ? presetFormatIds : FORMATS
  ) as TournamentFormat[];
  const totalRounds = getTotalRounds(schedule);

  const addDay = () => {
    if (schedule.length >= MAX_TOURNAMENT_DAYS || totalRounds >= MAX_TOURNAMENT_ROUNDS) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onScheduleChange([...schedule, { formats: ['scramble'] }]);
  };

  const removeDay = (dayIndex: number) => {
    if (schedule.length <= 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onScheduleChange(schedule.filter((_, index) => index !== dayIndex));
  };

  const addRoundToDay = (dayIndex: number) => {
    if (totalRounds >= MAX_TOURNAMENT_ROUNDS) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onScheduleChange(
      schedule.map((day, index) =>
        index === dayIndex ? { formats: [...day.formats, 'scramble'] } : day
      )
    );
  };

  const removeRoundFromDay = (dayIndex: number, roundIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const day = schedule[dayIndex];
    if (!day) return;

    if (day.formats.length > 1) {
      onScheduleChange(
        schedule.map((entry, index) =>
          index === dayIndex
            ? { formats: entry.formats.filter((_, i) => i !== roundIndex) }
            : entry
        )
      );
      return;
    }

    if (schedule.length > 1) {
      onScheduleChange(schedule.filter((_, index) => index !== dayIndex));
    }
  };

  const setRoundFormat = (dayIndex: number, roundIndex: number, format: TournamentFormat) => {
    onScheduleChange(
      schedule.map((day, index) =>
        index === dayIndex
          ? {
              formats: day.formats.map((current, i) => (i === roundIndex ? format : current)),
            }
          : day
      )
    );
  };

  const addCustomFormat = (dayIndex: number, roundIndex: number) => {
    const key = scheduleKey(dayIndex, roundIndex);
    const label = customFormatByKey[key]?.trim();
    if (!label || !onCustomFormatChange) return;
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!slug) return;
    setRoundFormat(dayIndex, roundIndex, slug);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View>
      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">Schedule</Text>
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
                {formatOptions.map((f) => (
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
                      {formatLabel(f)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {onCustomFormatChange ? (
                <View className="flex-row gap-2 mt-2">
                  <TextInput
                    value={customFormatByKey[scheduleKey(dayIndex, roundIndex)] ?? ''}
                    onChangeText={(text) =>
                      onCustomFormatChange(scheduleKey(dayIndex, roundIndex), text)
                    }
                    placeholder="Custom format name"
                    placeholderTextColor="#525252"
                    className="flex-1 bg-[#141414] border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs"
                  />
                  <Pressable
                    onPress={() => addCustomFormat(dayIndex, roundIndex)}
                    className="px-3 py-2 rounded-lg border border-lime-700/50 bg-lime-900/20 active:opacity-80"
                  >
                    <Text className="text-lime-400 text-xs font-semibold">+ Add</Text>
                  </Pressable>
                </View>
              ) : null}
              {!formatOptions.includes(roundFormat as (typeof formatOptions)[number]) && (
                <Text className="text-lime-400 text-xs mt-1">
                  Selected: {formatLabel(roundFormat)}
                </Text>
              )}
            </View>
          ))}

          {totalRounds < MAX_TOURNAMENT_ROUNDS && (
            <Pressable
              onPress={() => addRoundToDay(dayIndex)}
              className="flex-row items-center justify-center border border-dashed border-neutral-700 rounded-lg py-2 mt-1 active:opacity-80"
            >
              <Plus size={14} color="#a3e635" />
              <Text className="text-lime-400 text-xs font-semibold ml-1.5">Add round today</Text>
            </Pressable>
          )}
        </View>
      ))}

      {schedule.length < MAX_TOURNAMENT_DAYS && totalRounds < MAX_TOURNAMENT_ROUNDS && (
        <Pressable
          onPress={addDay}
          className="flex-row items-center justify-center border border-dashed border-neutral-700 rounded-xl py-3 mb-2 active:opacity-80"
        >
          <Plus size={16} color="#a3e635" />
          <Text className="text-lime-400 font-semibold ml-2">Add Day</Text>
        </Pressable>
      )}
    </View>
  );
}
