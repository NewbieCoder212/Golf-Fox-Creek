import { View, Text } from 'react-native';

import {
  formatLabelFromSettings,
  formatScoringHintFromSettings,
  resolveFormatDefinition,
} from '@/lib/tournament-format-settings';
import type { TournamentFormat, TournamentFormatsSettings } from '@/types';

interface TournamentFormatRulesCardProps {
  formatId: TournamentFormat;
  settings?: TournamentFormatsSettings | null;
  compact?: boolean;
}

export function TournamentFormatRulesCard({
  formatId,
  settings,
  compact = false,
}: TournamentFormatRulesCardProps) {
  const definition = resolveFormatDefinition(formatId, settings);
  const label = formatLabelFromSettings(formatId, settings);
  const hint = formatScoringHintFromSettings(formatId, settings);

  if (compact) {
    return (
      <View className="bg-[#141414] rounded-xl border border-neutral-800 p-4">
        <Text className="text-lime-400 font-semibold">{label}</Text>
        <Text className="text-neutral-400 text-sm mt-1">{hint}</Text>
      </View>
    );
  }

  return (
    <View className="bg-[#141414] rounded-xl border border-lime-700/30 p-4">
      <Text className="text-lime-400 text-xs font-bold uppercase tracking-widest">Format</Text>
      <Text className="text-white font-bold text-lg mt-1">{label}</Text>
      <Text className="text-neutral-400 text-sm mt-2">{hint}</Text>

      {definition?.how_it_works ? (
        <View className="mt-4">
          <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-1">
            How it works
          </Text>
          <Text className="text-neutral-300 text-sm leading-5">{definition.how_it_works}</Text>
        </View>
      ) : null}

      {definition?.the_score ? (
        <View className="mt-3">
          <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-1">The Score</Text>
          <Text className="text-neutral-300 text-sm leading-5">{definition.the_score}</Text>
        </View>
      ) : null}
    </View>
  );
}
