import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Save, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateTournamentFormatsSettingsAuth } from '@/lib/supabase';
import { useTournamentFormatsSettings } from '@/lib/useTournamentFormatsSettings';
import type { TournamentFormatDefinition, TournamentFormatsSettings } from '@/types';
import { cn } from '@/lib/cn';

interface AdminTournamentFormatsTabProps {
  accessToken: string;
}

export function AdminTournamentFormatsTab({ accessToken }: AdminTournamentFormatsTabProps) {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useTournamentFormatsSettings();
  const [draft, setDraft] = useState<TournamentFormatsSettings | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>('scramble');

  const activeSettings = draft ?? settings;

  const saveMutation = useMutation({
    mutationFn: async (payload: TournamentFormatsSettings) => {
      const ok = await updateTournamentFormatsSettingsAuth(payload, accessToken);
      if (!ok) throw new Error('Could not save format settings');
      return payload;
    },
    onSuccess: (payload) => {
      queryClient.setQueryData(['tournamentFormatsSettings'], payload);
      setDraft(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Tournament format rules updated.');
    },
    onError: (error: Error) => {
      Alert.alert('Save failed', error.message);
    },
  });

  if (isLoading || !activeSettings) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color="#a3e635" />
      </View>
    );
  }

  const updateFormat = (id: string, patch: Partial<TournamentFormatDefinition>) => {
    setDraft((prev) => {
      const base = prev ?? activeSettings;
      return {
        ...base,
        formats: base.formats.map((format) =>
          format.id === id ? { ...format, ...patch } : format
        ),
      };
    });
  };

  const toggleActive = (id: string) => {
    setDraft((prev) => {
      const base = prev ?? activeSettings;
      const active = new Set(base.active_format_ids);
      if (active.has(id)) active.delete(id);
      else active.add(id);
      return { ...base, active_format_ids: Array.from(active) };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const weekendFormats = activeSettings.formats.filter((format) =>
    ['scramble', 'best_ball', 'singles'].includes(format.id)
  );

  return (
    <View>
      <Text className="text-neutral-400 text-sm mb-4 leading-5">
        These rules drive how matches are set up and scored. Active formats appear when scheduling
        rounds and creating foursomes.
      </Text>

      {weekendFormats.map((format) => {
        const isActive = activeSettings.active_format_ids.includes(format.id);
        const expanded = expandedId === format.id;

        return (
          <View
            key={format.id}
            className="bg-[#141414] rounded-2xl border border-neutral-800 mb-3 overflow-hidden"
          >
            <Pressable
              onPress={() => setExpandedId(expanded ? null : format.id)}
              className="flex-row items-center p-4 active:opacity-80"
            >
              <View className="flex-1">
                <Text className="text-white font-semibold">{format.label}</Text>
                <Text className="text-neutral-500 text-xs mt-0.5 capitalize">
                  {format.scoring_mode.replace(/_/g, ' ')}
                </Text>
              </View>
              <Pressable
                onPress={() => toggleActive(format.id)}
                className={cn(
                  'px-3 py-1 rounded-full border mr-2',
                  isActive
                    ? 'bg-lime-900/40 border-lime-600'
                    : 'bg-neutral-900 border-neutral-700'
                )}
              >
                <Text
                  className={cn(
                    'text-xs font-semibold',
                    isActive ? 'text-lime-400' : 'text-neutral-500'
                  )}
                >
                  {isActive ? 'Active' : 'Off'}
                </Text>
              </Pressable>
              {expanded ? (
                <ChevronUp size={18} color="#737373" />
              ) : (
                <ChevronDown size={18} color="#737373" />
              )}
            </Pressable>

            {expanded && (
              <View className="px-4 pb-4 border-t border-neutral-800">
                <Text className="text-neutral-500 text-xs uppercase tracking-widest mt-3 mb-2">
                  Display Name
                </Text>
                <TextInput
                  value={format.label}
                  onChangeText={(text) => updateFormat(format.id, { label: text })}
                  className="bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white mb-3"
                />

                <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                  Scoring Summary
                </Text>
                <TextInput
                  value={format.scoring_hint}
                  onChangeText={(text) => updateFormat(format.id, { scoring_hint: text })}
                  className="bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white mb-3"
                />

                <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                  How It Works
                </Text>
                <TextInput
                  value={format.how_it_works}
                  onChangeText={(text) => updateFormat(format.id, { how_it_works: text })}
                  multiline
                  textAlignVertical="top"
                  className="bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white mb-3 min-h-[120px]"
                />

                <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                  The Score
                </Text>
                <TextInput
                  value={format.the_score}
                  onChangeText={(text) => updateFormat(format.id, { the_score: text })}
                  multiline
                  textAlignVertical="top"
                  className="bg-[#0c0c0c] border border-neutral-800 rounded-xl px-4 py-3 text-white min-h-[72px]"
                />
              </View>
            )}
          </View>
        );
      })}

      <Pressable
        onPress={() => saveMutation.mutate(activeSettings)}
        disabled={saveMutation.isPending}
        className="flex-row items-center justify-center bg-lime-600 rounded-xl py-4 mt-2 active:opacity-80"
      >
        {saveMutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Save size={18} color="#fff" />
            <Text className="text-white font-bold ml-2">Save Format Rules</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
