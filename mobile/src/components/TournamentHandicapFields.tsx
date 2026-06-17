import { View, Text, TextInput, Pressable } from 'react-native';

import type { HandicapAllowancePct } from '@/lib/tournament-scoring';
import { cn } from '@/lib/cn';

const ALLOWANCE_OPTIONS: HandicapAllowancePct[] = [75, 85, 100];

export interface TournamentHandicapFieldsProps {
  useIndex: boolean;
  onUseIndexChange: (value: boolean) => void;
  allowancePct: HandicapAllowancePct;
  onAllowancePctChange: (value: HandicapAllowancePct) => void;
  manualHandicap?: string;
  onManualHandicapChange?: (value: string) => void;
  showManualField?: boolean;
  inheritLabel?: string;
  resolvedPreview?: string;
  compact?: boolean;
}

export function TournamentHandicapFields({
  useIndex,
  onUseIndexChange,
  allowancePct,
  onAllowancePctChange,
  manualHandicap = '',
  onManualHandicapChange,
  showManualField = false,
  inheritLabel,
  resolvedPreview,
  compact = false,
}: TournamentHandicapFieldsProps) {
  return (
    <View className={compact ? 'gap-2' : 'gap-3'}>
      {inheritLabel ? (
        <Text className="text-neutral-500 text-xs">{inheritLabel}</Text>
      ) : null}

      <View>
        <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
          Handicap source
        </Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => onUseIndexChange(true)}
            className={cn(
              'flex-1 rounded-xl py-2.5 items-center border',
              useIndex ? 'bg-lime-900/30 border-lime-600' : 'bg-[#141414] border-neutral-800'
            )}
          >
            <Text className={useIndex ? 'text-lime-400 font-semibold text-sm' : 'text-neutral-400 text-sm'}>
              Handicap Index
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onUseIndexChange(false)}
            className={cn(
              'flex-1 rounded-xl py-2.5 items-center border',
              !useIndex ? 'bg-lime-900/30 border-lime-600' : 'bg-[#141414] border-neutral-800'
            )}
          >
            <Text className={!useIndex ? 'text-lime-400 font-semibold text-sm' : 'text-neutral-400 text-sm'}>
              Manual
            </Text>
          </Pressable>
        </View>
      </View>

      {showManualField && !useIndex && onManualHandicapChange ? (
        <View>
          <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
            Manual handicap
          </Text>
          <TextInput
            value={manualHandicap}
            onChangeText={onManualHandicapChange}
            placeholder="e.g. 12 or 12.5"
            placeholderTextColor="#525252"
            keyboardType="decimal-pad"
            className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-3 text-white"
            style={{ color: '#ffffff' }}
          />
        </View>
      ) : null}

      <View>
        <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
          Allowance
        </Text>
        <View className="flex-row gap-2">
          {ALLOWANCE_OPTIONS.map((pct) => (
            <Pressable
              key={pct}
              onPress={() => onAllowancePctChange(pct)}
              className={cn(
                'flex-1 rounded-xl py-2.5 items-center border',
                allowancePct === pct
                  ? 'bg-lime-900/30 border-lime-600'
                  : 'bg-[#141414] border-neutral-800'
              )}
            >
              <Text
                className={
                  allowancePct === pct
                    ? 'text-lime-400 font-semibold text-sm'
                    : 'text-neutral-400 text-sm'
                }
              >
                {pct}%
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {resolvedPreview ? (
        <Text className="text-neutral-400 text-xs">Plays off {resolvedPreview}</Text>
      ) : null}
    </View>
  );
}

export function PlayerHandicapOverrideFields({
  inheritTournamentDefaults,
  onInheritChange,
  useIndex,
  onUseIndexChange,
  allowancePct,
  onAllowancePctChange,
  manualHandicap,
  onManualHandicapChange,
  resolvedPreview,
}: {
  inheritTournamentDefaults: boolean;
  onInheritChange: (value: boolean) => void;
  useIndex: boolean;
  onUseIndexChange: (value: boolean) => void;
  allowancePct: HandicapAllowancePct;
  onAllowancePctChange: (value: HandicapAllowancePct) => void;
  manualHandicap: string;
  onManualHandicapChange: (value: string) => void;
  resolvedPreview?: string;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => onInheritChange(true)}
          className={cn(
            'flex-1 rounded-xl py-2.5 items-center border',
            inheritTournamentDefaults
              ? 'bg-lime-900/30 border-lime-600'
              : 'bg-[#141414] border-neutral-800'
          )}
        >
          <Text
            className={
              inheritTournamentDefaults
                ? 'text-lime-400 font-semibold text-sm'
                : 'text-neutral-400 text-sm'
            }
          >
            Inherit event
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onInheritChange(false)}
          className={cn(
            'flex-1 rounded-xl py-2.5 items-center border',
            !inheritTournamentDefaults
              ? 'bg-lime-900/30 border-lime-600'
              : 'bg-[#141414] border-neutral-800'
          )}
        >
          <Text
            className={
              !inheritTournamentDefaults
                ? 'text-lime-400 font-semibold text-sm'
                : 'text-neutral-400 text-sm'
            }
          >
            Override
          </Text>
        </Pressable>
      </View>

      {!inheritTournamentDefaults ? (
        <TournamentHandicapFields
          useIndex={useIndex}
          onUseIndexChange={onUseIndexChange}
          allowancePct={allowancePct}
          onAllowancePctChange={onAllowancePctChange}
          manualHandicap={manualHandicap}
          onManualHandicapChange={onManualHandicapChange}
          showManualField
          resolvedPreview={resolvedPreview}
          compact
        />
      ) : resolvedPreview ? (
        <Text className="text-neutral-400 text-xs">Plays off {resolvedPreview}</Text>
      ) : null}
    </View>
  );
}
