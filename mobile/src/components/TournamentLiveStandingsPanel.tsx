import { useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Medal, Radio } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { SponsorBanner } from '@/components/SponsorBanner';
import { TournamentCopyTvLinkButton } from '@/components/TournamentCopyTvLinkButton';
import { TournamentTeamMatchupBoard } from '@/components/TournamentTeamMatchupBoard';
import {
  buildMatchPointsLeaderboard,
  buildTournamentLeaderboard,
  getTournamentById,
  getTournamentScores,
  getTournamentTeams,
} from '@/lib/tournament-service';
import { getMembersForChallenge } from '@/lib/social-service';
import {
  getTeamBySide,
  getTournamentMatchGroups,
} from '@/lib/tournament-match-service';
import { buildTournamentPlayerMaps, getTournamentPlayers } from '@/lib/tournament-player-service';
import { formatClubTime } from '@/lib/club-timezone';
import { cn } from '@/lib/cn';

interface TournamentLiveStandingsPanelProps {
  tournamentId: string;
  displayToken?: string | null;
  showTvLink?: boolean;
  showSponsorBanner?: boolean;
  compact?: boolean;
}

export function TournamentLiveStandingsPanel({
  tournamentId,
  displayToken,
  showTvLink = false,
  showSponsorBanner = false,
  compact = false,
}: TournamentLiveStandingsPanelProps) {
  const [leaderboardMode, setLeaderboardMode] = useState<'gross' | 'net'>('net');

  const { data: tournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => getTournamentById(tournamentId),
    enabled: Boolean(tournamentId),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['tournamentTeams', tournamentId],
    queryFn: () => getTournamentTeams(tournamentId),
    enabled: Boolean(tournamentId),
    refetchInterval: 15_000,
  });

  const { data: scores = [], isPending: scoresPending, dataUpdatedAt } = useQuery({
    queryKey: ['tournamentScores', tournamentId],
    queryFn: () => getTournamentScores(tournamentId),
    enabled: Boolean(tournamentId),
    refetchInterval: 15_000,
  });

  const { data: matchGroups = [] } = useQuery({
    queryKey: ['tournamentMatchGroups', tournamentId],
    queryFn: () => getTournamentMatchGroups(tournamentId),
    enabled: Boolean(tournamentId),
    refetchInterval: 15_000,
  });

  const sideATeam = getTeamBySide(teams, 'side_a');
  const sideBTeam = getTeamBySide(teams, 'side_b');

  const { data: tournamentPlayers = [] } = useQuery({
    queryKey: ['tournamentPlayers', tournamentId],
    queryFn: () => getTournamentPlayers(tournamentId),
    enabled: Boolean(tournamentId),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['membersForTeam'],
    queryFn: getMembersForChallenge,
  });

  const matchPointsLeaderboard = useMemo(
    () => buildMatchPointsLeaderboard(teams, matchGroups),
    [teams, matchGroups]
  );

  const leaderboard = useMemo(
    () => buildTournamentLeaderboard(scores, leaderboardMode),
    [scores, leaderboardMode]
  );

  const teamNameById = useMemo(
    () => Object.fromEntries(teams.map((team) => [team.id, team.team_name])),
    [teams]
  );

  const { nameById: playerNameById } = useMemo(
    () => buildTournamentPlayerMaps(tournamentPlayers, members),
    [tournamentPlayers, members]
  );

  const isInitialLoad = scoresPending;
  const lastUpdated =
    dataUpdatedAt > 0 ? formatClubTime(new Date(dataUpdatedAt).toISOString(), true) : null;

  return (
    <View>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center bg-lime-950/40 border border-lime-700/30 rounded-full px-3 py-1.5">
          <Radio size={12} color="#a3e635" />
          <Text className="text-lime-400 text-[10px] font-semibold ml-1.5 uppercase tracking-wider">
            Live
          </Text>
          {isInitialLoad ? (
            <ActivityIndicator size="small" color="#a3e635" style={{ marginLeft: 6 }} />
          ) : null}
        </View>
        {lastUpdated ? (
          <Text className="text-neutral-600 text-[10px]">Updated {lastUpdated}</Text>
        ) : null}
      </View>

      {showTvLink && displayToken && tournament ? (
        <View className="mb-3">
          <TournamentCopyTvLinkButton
            tournamentId={tournament.id}
            displayToken={displayToken}
            compact
          />
        </View>
      ) : null}

      {showSponsorBanner ? (
        <SponsorBanner
          placementType="leaderboard"
          displayPosition="footer"
          className="mb-2"
          compact
        />
      ) : null}

      {sideATeam && sideBTeam ? (
        <TournamentTeamMatchupBoard
          teams={teams}
          teamStats={matchPointsLeaderboard.map((row) => ({
            teamId: row.teamId,
            matchPoints: row.matchPoints,
            matchesWon: row.matchesWon,
          }))}
          subtitle="Team Matchup"
          compact={compact}
          minimal={compact}
          className="mb-3"
        />
      ) : (
        <View className="py-8 items-center bg-[#141414] rounded-2xl border border-neutral-800 mb-3">
          <Text className="text-neutral-400 text-sm text-center px-4">
            Teams not configured yet. Check the Teams tab.
          </Text>
        </View>
      )}

      {!compact ? (
        <>
      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2 mt-1">
        Stroke Standings
      </Text>
      <View className="flex-row bg-[#141414] rounded-xl border border-neutral-800 p-1 mb-2">
        {(['net', 'gross'] as const).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setLeaderboardMode(mode);
            }}
            className={cn(
              'flex-1 py-2 rounded-lg items-center',
              leaderboardMode === mode && 'bg-lime-600'
            )}
          >
            <Text
              className={cn(
                'text-xs font-semibold uppercase tracking-wider',
                leaderboardMode === mode ? 'text-white' : 'text-neutral-500'
              )}
            >
              {mode === 'net' ? 'Net (Playing Hcp)' : 'Gross'}
            </Text>
          </Pressable>
        ))}
      </View>

      {leaderboard.length === 0 ? (
        <View className="py-12 items-center bg-[#141414] rounded-2xl border border-neutral-800">
          <Medal size={36} color="#525252" />
          <Text className="text-neutral-400 mt-3">No scores submitted yet</Text>
        </View>
      ) : (
        leaderboard.map((entry, index) => (
          <Animated.View
            key={entry.key}
            entering={FadeInDown.delay(index * 40).duration(300)}
            className="flex-row items-center bg-[#141414] border border-neutral-800 rounded-xl p-4 mt-3"
          >
            <View
              className={cn(
                'w-8 h-8 rounded-full items-center justify-center mr-3',
                index === 0 ? 'bg-yellow-500/20' : 'bg-neutral-800'
              )}
            >
              <Text
                className={cn(
                  'font-bold text-sm',
                  index === 0 ? 'text-yellow-400' : 'text-neutral-400'
                )}
              >
                {index + 1}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold">
                {teamNameById[entry.key] ?? playerNameById[entry.key] ?? 'Player'}
              </Text>
              <Text className="text-neutral-500 text-xs mt-0.5">
                {entry.rounds_played} round{entry.rounds_played !== 1 ? 's' : ''} played
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-lime-400 font-bold text-lg">
                {leaderboardMode === 'net' ? entry.total_net : entry.total_gross}
              </Text>
              <Text className="text-neutral-500 text-xs">
                {leaderboardMode === 'net'
                  ? `Net (${entry.total_gross} gross)`
                  : `Gross (${entry.total_net} net)`}
              </Text>
            </View>
          </Animated.View>
        ))
      )}
        </>
      ) : null}
    </View>
  );
}
