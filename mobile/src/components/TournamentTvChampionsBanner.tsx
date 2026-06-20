import { View, Text, Image } from 'react-native';
import { Trophy } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { getTeamSideTheme } from '@/lib/match-play-theme';
import { getTeamSideDisplayName } from '@/lib/tournament-labels';
import {
  formatTournamentTvChampionScoreLine,
  type TournamentTvChampionResult,
} from '@/lib/tournament-tv-display';
import type { TournamentTeam, TournamentTeamSide } from '@/types';

interface TournamentTvChampionsBannerProps {
  champion: TournamentTvChampionResult;
  compact?: boolean;
  className?: string;
}

function ChampionLogo({
  team,
  side,
  size,
}: {
  team: TournamentTeam;
  side: TournamentTeamSide;
  size: number;
}) {
  const theme = getTeamSideTheme(side);

  if (team.logo_url) {
    return (
      <View
        style={{
          padding: 4,
          borderRadius: (size + 8) / 2,
          borderWidth: 2,
          borderColor: theme.ringBorder,
          backgroundColor: theme.ringGlow,
        }}
      >
        <Image
          source={{ uri: team.logo_url }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.panelBg,
        borderWidth: 2,
        borderColor: theme.panelBorder,
      }}
      className="items-center justify-center"
    >
      <Text style={{ color: theme.colorLight, fontSize: size * 0.34, fontWeight: '700' }}>
        ?
      </Text>
    </View>
  );
}

export function TournamentTvChampionsBanner({
  champion,
  compact = false,
  className,
}: TournamentTvChampionsBannerProps) {
  const side = champion.team.side ?? 'side_a';
  const theme = getTeamSideTheme(side);
  const teamName =
    champion.team.team_name?.trim() || getTeamSideDisplayName(side, [champion.team]);
  const scoreLine = formatTournamentTvChampionScoreLine(champion);
  const logoSize = compact ? 56 : 72;

  return (
    <View
      className={cn(
        'rounded-2xl overflow-hidden border bg-[#101010]',
        compact ? 'px-4 py-4' : 'px-5 py-5',
        className
      )}
      style={{ borderColor: theme.panelBorder }}
    >
      <View
        className="absolute inset-0 opacity-30"
        style={{ backgroundColor: theme.panelBg }}
      />

      <View className="flex-row items-center gap-4">
        <View
          className={cn(
            'rounded-full items-center justify-center shrink-0',
            compact ? 'w-12 h-12' : 'w-14 h-14'
          )}
          style={{
            backgroundColor: 'rgba(250, 204, 21, 0.12)',
            borderWidth: 1,
            borderColor: 'rgba(250, 204, 21, 0.35)',
          }}
        >
          <Trophy size={compact ? 22 : 26} color="#facc15" />
        </View>

        <View className="flex-1 min-w-0">
          <Text
            className={cn(
              'text-amber-300 uppercase tracking-[0.18em] font-semibold',
              compact ? 'text-[9px]' : 'text-[10px]'
            )}
          >
            Champions
          </Text>
          <Text
            className={cn('text-white font-bold mt-1', compact ? 'text-lg' : 'text-2xl')}
            numberOfLines={2}
          >
            Congratulations to Team {teamName}
          </Text>
          <Text
            className={cn('text-lime-400 font-semibold mt-1', compact ? 'text-sm' : 'text-base')}
            numberOfLines={2}
          >
            {champion.eventTitle} Champions
          </Text>
          <Text className={cn('text-neutral-400 mt-1', compact ? 'text-xs' : 'text-sm')}>
            {scoreLine}
          </Text>
        </View>

        <ChampionLogo team={champion.team} side={side} size={logoSize} />
      </View>
    </View>
  );
}
