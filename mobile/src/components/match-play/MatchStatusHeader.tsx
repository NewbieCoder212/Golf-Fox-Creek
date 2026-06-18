import { View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { MatchStatus } from '@/lib/tournament-match-status';
import { getMatchWinnerTheme, SIDE_A_COLOR, SIDE_B_COLOR } from '@/lib/match-play-theme';
import { cn } from '@/lib/cn';

interface MatchStatusHeaderProps {
  matchStatus: MatchStatus;
  sideAName: string;
  sideBName: string;
  subtitle?: string;
  compact?: boolean;
}

export function MatchStatusHeader({
  matchStatus,
  sideAName,
  sideBName,
  subtitle,
  compact = false,
}: MatchStatusHeaderProps) {
  const totalHoles = 18;
  const lead = matchStatus.lead;
  const maxLead = totalHoles;

  const sideAWeight = lead > 0 ? Math.min(lead / maxLead, 1) : 0;
  const sideBWeight = lead < 0 ? Math.min(Math.abs(lead) / maxLead, 1) : 0;
  const neutralWeight = 1 - sideAWeight - sideBWeight;

  const displayLabel =
    matchStatus.throughHole === 0
      ? 'ALL SQUARE'
      : matchStatus.label;

  const winnerSide = matchStatus.clinched
    ? matchStatus.lead > 0
      ? 'side_a'
      : matchStatus.lead < 0
        ? 'side_b'
        : 'tie'
    : null;
  const winnerTheme = getMatchWinnerTheme(winnerSide);

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      className={cn(
        'mx-4 rounded-2xl border border-neutral-800 overflow-hidden',
        compact ? 'mb-2' : 'mb-3'
      )}
    >
      <View className="bg-[#141414] px-4 pt-4 pb-3">
        <View className="flex-row justify-between mb-2">
          <Text className="text-red-400 text-sm font-bold uppercase tracking-wide">
            {sideAName}
          </Text>
          <Text className="text-blue-400 text-sm font-bold uppercase tracking-wide">
            {sideBName}
          </Text>
        </View>

        <View className="h-3 rounded-full overflow-hidden flex-row bg-neutral-800">
          {sideAWeight > 0 ? (
            <View
              style={{
                flex: sideAWeight,
                backgroundColor: SIDE_A_COLOR,
              }}
            />
          ) : null}
          {neutralWeight > 0 ? (
            <View style={{ flex: neutralWeight }} className="bg-neutral-700" />
          ) : null}
          {sideBWeight > 0 ? (
            <View
              style={{
                flex: sideBWeight,
                backgroundColor: SIDE_B_COLOR,
              }}
            />
          ) : null}
        </View>

        <Text
          className={cn(
            'text-center font-bold mt-3',
            compact ? 'text-lg' : 'text-2xl'
          )}
          style={matchStatus.clinched ? { color: winnerTheme.color } : { color: '#fff' }}
        >
          {displayLabel}
        </Text>

        {subtitle ? (
          <Text className="text-neutral-500 text-xs text-center mt-1">{subtitle}</Text>
        ) : matchStatus.throughHole > 0 ? (
          <Text className="text-neutral-500 text-xs text-center mt-1">
            thru {matchStatus.throughHole} · {matchStatus.holesRemaining} left
          </Text>
        ) : null}
      </View>

      {matchStatus.clinched ? (
        <View
          className="px-4 py-2 border-t"
          style={{
            backgroundColor: winnerTheme.ringGlow,
            borderTopColor: winnerTheme.panelBorder,
          }}
        >
          <Text
            style={{ color: winnerTheme.colorLight }}
            className="text-center text-sm font-semibold"
          >
            Match Complete — {displayLabel}
          </Text>
        </View>
      ) : matchStatus.dormie ? (
        <View className="bg-amber-900/30 px-4 py-2 border-t border-amber-800/40">
          <Text className="text-amber-200 text-center text-xs font-semibold uppercase tracking-wider">
            Dormie
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}
