import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Radio } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchTournamentDisplay } from '@/lib/display-service';
import { useTournamentDisplayRealtime } from '@/hooks/useTournamentDisplayRealtime';
import { formatTournamentDates, formatRoundPickerLabel } from '@/lib/tournament-labels';
import { formatClubTime } from '@/lib/club-timezone';
import { TvSponsorCarousel, TvSponsorSlot } from '@/components/TvSponsorSlot';
import { TournamentLiveMatchGrids } from '@/components/TournamentLiveMatchGrids';
import { TournamentTeamMatchupBoard } from '@/components/TournamentTeamMatchupBoard';
import { buildTournamentPlayerMaps } from '@/lib/tournament-player-service';
import { getTeamBySide } from '@/lib/tournament-match-service';
import { buildMatchPointsLeaderboard } from '@/lib/tournament-service';
import { getTvDisplayRoundNumber } from '@/lib/tournament-tv-display';
import type { Tournament, TournamentPlayer, TournamentTeam } from '@/types';

export default function TournamentTvDisplayScreen() {
  const { id, token } = useLocalSearchParams<{ id: string; token?: string }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const displayEnabled = Boolean(id && token);

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['tournamentDisplay', id, token],
    queryFn: () => fetchTournamentDisplay(id!, token!),
    enabled: displayEnabled,
    staleTime: 10_000,
    refetchInterval: 10_000,
  });

  const tournament = data?.tournament as Tournament | undefined;
  const teams = (data?.teams ?? []) as TournamentTeam[];
  const tournamentPlayers = (data?.players ?? []) as TournamentPlayer[];
  const scores = data?.scores ?? [];
  const matchGroups = data?.matchGroups ?? [];
  const holeResults = data?.holeResults ?? [];

  const teamNameById = useMemo(
    () => Object.fromEntries(teams.map((team) => [team.id, team.team_name])),
    [teams]
  );

  const { nameById: playerNameById } = useMemo(
    () => buildTournamentPlayerMaps(tournamentPlayers, []),
    [tournamentPlayers]
  );

  const displayRound = useMemo(() => {
    if (!tournament) return 1;
    return getTvDisplayRoundNumber(tournament, matchGroups);
  }, [tournament, matchGroups]);

  const roundLabel = useMemo(() => {
    if (!tournament) return `Round ${displayRound}`;
    return formatRoundPickerLabel(tournament, displayRound);
  }, [tournament, displayRound]);

  const currentRoundMatchGroups = useMemo(
    () => matchGroups.filter((group) => group.round_number === displayRound),
    [matchGroups, displayRound]
  );

  const matchUseNetScoring = tournament?.match_use_net_scoring ?? false;

  const sideATeam = getTeamBySide(teams, 'side_a');
  const sideBTeam = getTeamBySide(teams, 'side_b');

  const teamStats = useMemo(() => {
    const pointsStats = buildMatchPointsLeaderboard(teams, matchGroups);
    const hasMatchPoints = pointsStats.some(
      (row) => row.matchPoints > 0 || row.matchesPlayed > 0
    );

    if (hasMatchPoints) {
      return pointsStats.map((row) => ({
        teamId: row.teamId,
        matchPoints: row.matchPoints,
        matchesWon: row.matchesWon,
      }));
    }

    const matchPlay = data?.matchPlay;
    if (matchPlay && sideATeam && sideBTeam) {
      return [
        { teamId: sideATeam.id, holesWon: matchPlay.sideAHoles },
        { teamId: sideBTeam.id, holesWon: matchPlay.sideBHoles },
      ];
    }

    return pointsStats.map((row) => ({
      teamId: row.teamId,
      matchPoints: row.matchPoints,
      matchesWon: row.matchesWon,
    }));
  }, [teams, matchGroups, data?.matchPlay, sideATeam, sideBTeam]);

  const handleRealtimeUpdate = useCallback(() => {
    void refetch();
  }, [refetch]);

  useTournamentDisplayRealtime(id, handleRealtimeUpdate);

  if (!token) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center px-8">
        <Text className="text-white text-2xl font-bold text-center">Invalid display link</Text>
        <Text className="text-neutral-400 text-center mt-3">
          Ask the pro shop for the full TV display URL including the access token.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center">
        <ActivityIndicator size="large" color="#a3e635" />
        <Text className="text-neutral-500 mt-4">Loading live standings…</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center px-8">
        <Text className="text-white text-2xl font-bold text-center">Unable to load display</Text>
        <Text className="text-neutral-400 text-center mt-3">
          {error instanceof Error ? error.message : 'Check the link or try again.'}
        </Text>
      </View>
    );
  }

  const lastUpdated = formatClubTime(new Date(dataUpdatedAt).toISOString(), true);

  return (
    <View
      className="flex-1 bg-[#0c0c0c] overflow-hidden"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Header */}
      <View className="px-5 py-2 border-b border-neutral-800 bg-[#111111]">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-3 min-w-0">
            {data.sponsors.header_left[0] && isLandscape ? (
              <View className="w-28 mr-3">
                <TvSponsorSlot sponsor={data.sponsors.header_left[0]} variant="header" />
              </View>
            ) : null}
            <View className="flex-1 min-w-0">
              <Text className="text-lime-400 text-[10px] font-semibold uppercase tracking-[0.2em]">
                Fox Creek Golf Club
              </Text>
              <Text className="text-white text-xl font-bold" numberOfLines={1}>
                {data.tournament.name}
              </Text>
              <Text className="text-lime-400 text-sm font-semibold mt-0.5" numberOfLines={1}>
                {roundLabel}
              </Text>
              <Text className="text-neutral-500 text-xs" numberOfLines={1}>
                {formatTournamentDates(data.tournament.start_date, data.tournament.end_date)}
              </Text>
            </View>
          </View>

          <View className="items-end shrink-0">
            <View className="flex-row items-center bg-lime-950/40 border border-lime-700/30 rounded-full px-2.5 py-1">
              <Radio size={12} color="#a3e635" />
              <Text className="text-lime-400 text-[10px] font-semibold ml-1 uppercase tracking-wider">
                Live
              </Text>
              {isFetching ? (
                <ActivityIndicator size="small" color="#a3e635" style={{ marginLeft: 6 }} />
              ) : null}
            </View>
            <Text className="text-neutral-600 text-[10px] mt-1">Updated {lastUpdated}</Text>
          </View>
        </View>
      </View>

      {/* Main — standings hero on top, live matches below */}
      <View className="flex-1 min-h-0 px-4 py-3 gap-3">
        {/* Hero standings */}
        <View className="shrink-0">
          {sideATeam && sideBTeam ? (
            <TournamentTeamMatchupBoard
              teams={teams}
              teamStats={teamStats}
              subtitle="Live Standings"
              tvHero
            />
          ) : !sideATeam && !sideBTeam && currentRoundMatchGroups.length === 0 ? (
            <View className="py-10 items-center bg-[#141414] rounded-xl border border-neutral-800">
              <Trophy size={28} color="#525252" />
              <Text className="text-neutral-500 text-sm mt-3">No scores yet</Text>
            </View>
          ) : null}

          {currentRoundMatchGroups.length > 0 && !sideATeam && !sideBTeam ? (
            <Text className="text-neutral-600 text-[10px] mt-2 px-1 leading-4 text-center">
              Team points update automatically as matches are completed.
            </Text>
          ) : null}
        </View>

        {/* Live matches in progress */}
        <View className="flex-1 min-h-0">
          <TournamentLiveMatchGrids
            matchGroups={matchGroups}
            scores={scores}
            holeResults={holeResults}
            teamNameById={teamNameById}
            playerNameById={playerNameById}
            useNetScoring={matchUseNetScoring}
            variant="tv-compact"
            roundNumber={displayRound}
            hideTitle
            layout="tv-carousel"
            liveOnly
          />
        </View>

        {/* Sponsors — horizontal strip under matches on wide screens */}
        {isLandscape && data.sponsors.sidebar.length > 0 ? (
          <View className="shrink-0 border-t border-neutral-800 pt-2">
            <Text className="text-neutral-600 text-[9px] uppercase tracking-widest mb-2">
              Presented by
            </Text>
            <TvSponsorCarousel sponsors={data.sponsors.sidebar} />
          </View>
        ) : null}
      </View>

      {/* Footer */}
      <View className="border-t border-neutral-800 bg-[#111111] px-5 py-2">
        {data.sponsors.footer.length > 0 ? (
          <TvSponsorCarousel sponsors={data.sponsors.footer} variant="footer" />
        ) : (
          <Text className="text-neutral-600 text-xs">Fox Creek Golf Club · Dieppe, NB</Text>
        )}
      </View>
    </View>
  );
}
