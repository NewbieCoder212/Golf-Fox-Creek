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
  /** Full-width centerpiece when the tournament is complete */
  hero?: boolean;
  heroWide?: boolean;
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
  hero = false,
  heroWide = false,
  className,
}: TournamentTvChampionsBannerProps) {
  const side = champion.team.side ?? 'side_a';
  const theme = getTeamSideTheme(side);
  const teamName =
    champion.team.team_name?.trim() || getTeamSideDisplayName(side, [champion.team]);
  const scoreLine = formatTournamentTvChampionScoreLine(champion);
  const logoSize = hero ? (heroWide ? 144 : 112) : compact ? 56 : 72;
  const trophySize = hero ? (heroWide ? 48 : 40) : compact ? 22 : 26;

  if (hero) {
    return (
      <View
        className={cn(
          'flex-1 rounded-2xl overflow-hidden border bg-[#101010] items-center justify-center px-8 py-10',
          className
        )}
        style={{ borderColor: theme.panelBorder }}
      >
        <View
          className="absolute inset-0 opacity-35"
          style={{ backgroundColor: theme.panelBg }}
        />

        <View
          className={cn(
            'rounded-full items-center justify-center mb-6',
            heroWide ? 'w-24 h-24' : 'w-20 h-20'
          )}
          style={{
            backgroundColor: 'rgba(250, 204, 21, 0.14)',
            borderWidth: 1.5,
            borderColor: 'rgba(250, 204, 21, 0.4)',
          }}
        >
          <Trophy size={trophySize} color="#facc15" />
        </View>

        <Text
          className={cn(
            'text-amber-300 uppercase tracking-[0.22em] font-semibold text-center',
            heroWide ? 'text-sm' : 'text-xs'
          )}
        >
          Champions
        </Text>
        <Text
          className={cn(
            'text-white font-bold text-center mt-4 leading-tight',
            heroWide ? 'text-5xl' : 'text-3xl'
          )}
          numberOfLines={3}
        >
          Congratulations to Team {teamName}
        </Text>
        <Text
          className={cn(
            'text-lime-400 font-semibold mt-4 text-center',
            heroWide ? 'text-3xl' : 'text-xl'
          )}
          numberOfLines={2}
        >
          {champion.eventTitle} Champions
        </Text>
        <Text
          className={cn('text-neutral-400 mt-4 text-center', heroWide ? 'text-xl' : 'text-base')}
        >
          {scoreLine}
        </Text>

        <View className="mt-8">
          <ChampionLogo team={champion.team} side={side} size={logoSize} />
        </View>
      </View>
    );
  }

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
          <Trophy size={trophySize} color="#facc15" />
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
