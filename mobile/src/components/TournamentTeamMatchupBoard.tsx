import { View, Text, Image } from 'react-native';
import { Swords } from 'lucide-react-native';

import { getTeamBySide } from '@/lib/tournament-match-service';
import { getTeamSideDisplayName } from '@/lib/tournament-labels';
import { getTeamSideTheme } from '@/lib/match-play-theme';
import { cn } from '@/lib/cn';
import type { TournamentTeam, TournamentTeamSide } from '@/types';

interface TeamStat {
  teamId: string;
  matchPoints?: number;
  matchesWon?: number;
  holesWon?: number;
}

interface TournamentTeamMatchupBoardProps {
  teams: TournamentTeam[];
  teamStats?: TeamStat[];
  subtitle?: string;
  className?: string;
  compact?: boolean;
  minimal?: boolean;
  hubEmbedded?: boolean;
}

function TeamLogo({
  uri,
  size,
  side,
  prominent = false,
}: {
  uri: string | null | undefined;
  size: number;
  side: TournamentTeamSide;
  prominent?: boolean;
}) {
  const theme = getTeamSideTheme(side);

  const logo = uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="cover"
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.panelBg,
        borderWidth: 1,
        borderColor: theme.panelBorder,
      }}
      className="items-center justify-center"
    >
      <Text style={{ color: theme.colorLight, fontSize: size * 0.34, fontWeight: '700' }}>
        ?
      </Text>
    </View>
  );

  if (!prominent) {
    return (
      <View
        style={{
          padding: 3,
          borderRadius: (size + 6) / 2,
          borderWidth: 2,
          borderColor: theme.ringBorder,
          backgroundColor: theme.ringGlow,
        }}
      >
        {logo}
      </View>
    );
  }

  return (
    <View
      style={{
        padding: 4,
        borderRadius: (size + 8) / 2,
        borderWidth: 2.5,
        borderColor: theme.ringBorder,
        backgroundColor: theme.ringGlow,
      }}
    >
      {logo}
    </View>
  );
}

function findStat(teamStats: TeamStat[] | undefined, teamId: string): TeamStat | undefined {
  return teamStats?.find((row) => row.teamId === teamId);
}

export function TournamentTeamMatchupBoard({
  teams,
  teamStats,
  subtitle,
  className,
  compact = false,
  minimal = false,
  hubEmbedded = false,
}: TournamentTeamMatchupBoardProps) {
  const sideA = getTeamBySide(teams, 'side_a');
  const sideB = getTeamBySide(teams, 'side_b');
  const themeA = getTeamSideTheme('side_a');
  const themeB = getTeamSideTheme('side_b');

  if (!sideA && !sideB) {
    return (
      <View className={cn('bg-fox-surface rounded-2xl border border-fox-border p-5', className)}>
        <Text className="text-neutral-500 text-sm font-body text-center">
          No teams configured yet.
        </Text>
      </View>
    );
  }

  const logoSize = hubEmbedded ? 88 : minimal ? 40 : compact ? 56 : 72;
  const statA = sideA ? findStat(teamStats, sideA.id) : undefined;
  const statB = sideB ? findStat(teamStats, sideB.id) : undefined;

  const pointsA = statA?.matchPoints ?? 0;
  const pointsB = statB?.matchPoints ?? 0;
  const aLeading = pointsA > pointsB;
  const bLeading = pointsB > pointsA;

  const renderTeamPanel = (
    team: TournamentTeam | undefined,
    side: TournamentTeamSide,
    stat: TeamStat | undefined,
    isLeading: boolean
  ) => {
    const theme = getTeamSideTheme(side);
    const displayName = team?.team_name?.trim() || getTeamSideDisplayName(side, teams);

    return (
      <View
        className="flex-1 items-center justify-center px-2"
        style={{
          backgroundColor: theme.panelBg,
          borderColor: isLeading ? theme.ringBorder : theme.panelBorder,
          borderWidth: isLeading ? 1.5 : 1,
        }}
      >
        {team ? (
          <>
            <TeamLogo uri={team.logo_url} size={logoSize} side={side} prominent={hubEmbedded} />
            <Text
              className={cn(
                'font-display font-bold text-center text-white',
                hubEmbedded
                  ? 'text-xl mt-3 leading-7'
                  : minimal
                    ? 'text-xs mt-2'
                    : compact
                      ? 'text-base mt-2.5'
                      : 'text-lg mt-3 leading-6'
              )}
              numberOfLines={2}
            >
              {displayName}
            </Text>
            {stat?.matchPoints != null ? (
              <Text
                style={{ color: theme.color }}
                className={cn(
                  'font-display font-bold mt-1.5',
                  hubEmbedded ? 'text-4xl' : minimal ? 'text-xl' : 'text-3xl'
                )}
              >
                {stat.matchPoints}
              </Text>
            ) : stat?.holesWon != null ? (
              <Text
                style={{ color: theme.color }}
                className={cn(
                  'font-display font-bold mt-1.5',
                  hubEmbedded ? 'text-4xl' : minimal ? 'text-xl' : 'text-3xl'
                )}
              >
                {stat.holesWon}
              </Text>
            ) : null}
            {stat?.matchesWon != null && !minimal ? (
              <Text style={{ color: theme.colorLight }} className="text-[10px] font-body mt-1 opacity-80">
                {stat.matchesWon} match win{stat.matchesWon !== 1 ? 's' : ''}
              </Text>
            ) : null}
          </>
        ) : (
          <View className="items-center opacity-50 py-4">
            <TeamLogo uri={null} size={logoSize} side={side} prominent={hubEmbedded} />
            <Text
              className={cn(
                'font-display text-center mt-3 text-neutral-500',
                hubEmbedded ? 'text-base' : 'text-sm'
              )}
            >
              {displayName}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View
      className={cn(
        'rounded-2xl overflow-hidden border border-neutral-800 bg-[#0a0a0a]',
        className
      )}
    >
      {subtitle && !minimal ? (
        <View className="px-4 py-2 border-b border-neutral-800 bg-[#111]">
          <Text className="text-neutral-500 text-[10px] uppercase tracking-widest font-body-semibold text-center">
            {subtitle}
          </Text>
        </View>
      ) : null}

      <View
        className={cn('flex-row items-stretch', hubEmbedded ? 'min-h-[200px]' : minimal ? '' : '')}
      >
        {renderTeamPanel(sideA, 'side_a', statA, aLeading)}

        <View
          className={cn(
            'items-center justify-center bg-[#141414] border-x border-neutral-800',
            minimal ? 'px-1.5 py-3' : 'px-2 py-4'
          )}
        >
          <View
            className={cn(
              'rounded-full bg-neutral-900 border border-neutral-700 items-center justify-center',
              minimal ? 'w-7 h-7' : 'w-9 h-9'
            )}
          >
            <Swords size={minimal ? 12 : 16} color="#a3a3a3" strokeWidth={1.5} />
          </View>
          {!minimal ? (
            <Text className="text-neutral-600 text-[9px] font-body-bold mt-1 tracking-widest">VS</Text>
          ) : null}
        </View>

        {renderTeamPanel(sideB, 'side_b', statB, bLeading)}
      </View>

      {!minimal && statA?.matchPoints != null && statB?.matchPoints != null ? (
        <View className="flex-row h-1">
          <View
            style={{
              flex: Math.max(pointsA, 0.001),
              backgroundColor: themeA.color,
              opacity: aLeading || pointsA === pointsB ? 1 : 0.35,
            }}
          />
          <View
            style={{
              flex: Math.max(pointsB, 0.001),
              backgroundColor: themeB.color,
              opacity: bLeading || pointsA === pointsB ? 1 : 0.35,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
