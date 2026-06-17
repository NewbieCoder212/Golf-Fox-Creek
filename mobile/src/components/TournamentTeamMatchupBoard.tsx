import { View, Text, Image } from 'react-native';
import { Swords } from 'lucide-react-native';

import { getTeamBySide } from '@/lib/tournament-match-service';
import { cn } from '@/lib/cn';
import type { TournamentTeam } from '@/types';

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
}

function TeamLogo({ uri, size }: { uri: string | null | undefined; size: number }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-fox-surface-elevated border border-fox-border items-center justify-center"
    >
      <Text className="text-neutral-500 font-display" style={{ fontSize: size * 0.34 }}>
        ?
      </Text>
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
}: TournamentTeamMatchupBoardProps) {
  const sideA = getTeamBySide(teams, 'side_a');
  const sideB = getTeamBySide(teams, 'side_b');

  if (!sideA && !sideB) {
    return (
      <View className={cn('bg-fox-surface rounded-2xl border border-fox-border p-5', className)}>
        <Text className="text-neutral-500 text-sm font-body text-center">
          No teams configured yet.
        </Text>
      </View>
    );
  }

  const logoSize = minimal ? 44 : compact ? 64 : 88;
  const statA = sideA ? findStat(teamStats, sideA.id) : undefined;
  const statB = sideB ? findStat(teamStats, sideB.id) : undefined;

  const renderTeam = (team: TournamentTeam | undefined, label: string, stat?: TeamStat) => (
    <View className="flex-1 items-center px-2">
      {team ? (
        <>
          <TeamLogo uri={team.logo_url} size={logoSize} />
          <Text className={cn('text-fox-lime text-[10px] font-body-bold uppercase tracking-widest', minimal ? 'mt-2' : 'mt-3')}>
            {label}
          </Text>
          <Text
            className={cn(
              'text-white font-display text-center mt-1',
              minimal ? 'text-xs' : compact ? 'text-sm' : 'text-base'
            )}
            numberOfLines={2}
          >
            {team.team_name}
          </Text>
          {stat?.matchPoints != null ? (
            <Text
              className={cn(
                'text-lime-400 font-display mt-2',
                minimal ? 'text-lg' : 'text-2xl'
              )}
            >
              {stat.matchPoints}
            </Text>
          ) : stat?.holesWon != null ? (
            <Text
              className={cn('text-white font-display mt-2', minimal ? 'text-lg' : 'text-2xl')}
            >
              {stat.holesWon}
            </Text>
          ) : null}
          {stat?.matchesWon != null && !minimal ? (
            <Text className="text-neutral-500 text-[10px] font-body mt-1">
              {stat.matchesWon} match win{stat.matchesWon !== 1 ? 's' : ''}
            </Text>
          ) : null}
        </>
      ) : (
        <View className="items-center opacity-50">
          <TeamLogo uri={null} size={logoSize} />
          <Text className="text-neutral-500 text-xs font-body mt-3">{label} — TBD</Text>
        </View>
      )}
    </View>
  );

  return (
    <View className={cn('bg-fox-surface rounded-2xl border border-lime-700/30 overflow-hidden', className)}>
      {subtitle && !minimal ? (
        <View className="px-4 py-2 border-b border-fox-border/60">
          <Text className="text-neutral-500 text-[10px] uppercase tracking-widest font-body-semibold text-center">
            {subtitle}
          </Text>
        </View>
      ) : null}
      <View className={cn('flex-row items-center px-3', minimal ? 'py-2.5' : 'py-5')}>
        {renderTeam(sideA, 'Team A', statA)}
        <View className="items-center px-2">
          <View
            className={cn(
              'rounded-full bg-fox-surface-elevated border border-fox-border items-center justify-center',
              minimal ? 'w-8 h-8' : 'w-10 h-10'
            )}
          >
            <Swords size={minimal ? 14 : 18} color="#a3e635" strokeWidth={1.5} />
          </View>
          {!minimal ? <Text className="text-neutral-600 text-[10px] font-body-bold mt-1">VS</Text> : null}
        </View>
        {renderTeam(sideB, 'Team B', statB)}
      </View>
    </View>
  );
}
