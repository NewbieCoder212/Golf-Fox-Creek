import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Radio } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchTournamentDisplay, buildQrCodeUrl, buildTournamentMobileUrl } from '@/lib/display-service';
import { useTournamentDisplayRealtime } from '@/hooks/useTournamentDisplayRealtime';
import { formatTournamentDates, formatRoundPickerLabel } from '@/lib/tournament-labels';
import { formatClubTime } from '@/lib/club-timezone';
import { TvSponsorCarousel, TvSponsorSlot } from '@/components/TvSponsorSlot';
import { TournamentLiveMatchGrids } from '@/components/TournamentLiveMatchGrids';
import { buildTournamentPlayerMaps } from '@/lib/tournament-player-service';
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

  const handleRealtimeUpdate = useCallback(() => {
    void refetch();
  }, [refetch]);

  useTournamentDisplayRealtime(id, handleRealtimeUpdate);

  const mobileUrl = id ? buildTournamentMobileUrl(id) : '';
  const qrUrl = mobileUrl ? buildQrCodeUrl(mobileUrl, 72) : '';

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

  const showMatchPoints = data.matchPoints.length > 0;
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

      {/* Main — fixed viewport, no page scroll */}
      <View className="flex-1 flex-row min-h-0 px-4 py-3 gap-3">
        {/* Standings */}
        <View className="w-[260px] shrink-0">
          <View className="flex-row items-center mb-2">
            <Trophy size={16} color="#a3e635" />
            <Text className="text-white text-sm font-bold ml-1.5">Standings</Text>
          </View>

          {showMatchPoints ? (
            <View className="bg-[#141414] rounded-xl border border-lime-700/30 overflow-hidden mb-2">
              <Text className="text-neutral-500 text-[10px] uppercase tracking-widest px-3 pt-2 pb-1">
                Match Points
              </Text>
              {data.matchPoints.map((row) => (
                <View
                  key={`${row.rank}-${row.teamName}`}
                  className="flex-row items-center px-3 py-2 border-t border-neutral-800/80"
                >
                  <Text className="text-neutral-500 w-6 text-xs font-bold">{row.rank}</Text>
                  <Text className="text-white font-semibold flex-1 text-sm" numberOfLines={1}>
                    {row.teamName}
                  </Text>
                  <Text className="text-lime-400 font-bold text-lg mr-2">{row.matchPoints}</Text>
                  <Text className="text-neutral-600 text-[10px]">
                    {row.matchesWon}W/{row.matchesPlayed}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {data.matchPlay ? (
            <View className="bg-[#141414] rounded-xl border border-neutral-800 p-3">
              <Text className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2 text-center">
                Team Match Play
              </Text>
              <View className="flex-row items-center justify-between">
                <View className="flex-1 items-center">
                  <Text className="text-lime-400 text-[10px] font-bold uppercase" numberOfLines={1}>
                    {data.matchPlay.sideAName}
                  </Text>
                  <Text className="text-white text-2xl font-bold">{data.matchPlay.sideAHoles}</Text>
                </View>
                <Text className="text-neutral-600 text-sm font-bold px-2">vs</Text>
                <View className="flex-1 items-center">
                  <Text className="text-lime-400 text-[10px] font-bold uppercase" numberOfLines={1}>
                    {data.matchPlay.sideBName}
                  </Text>
                  <Text className="text-white text-2xl font-bold">{data.matchPlay.sideBHoles}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {!showMatchPoints && !data.matchPlay && currentRoundMatchGroups.length === 0 ? (
            <View className="py-8 items-center bg-[#141414] rounded-xl border border-neutral-800">
              <Text className="text-neutral-500 text-sm">No scores yet</Text>
            </View>
          ) : null}

          {currentRoundMatchGroups.length > 0 && !data.matchPlay ? (
            <Text className="text-neutral-600 text-[10px] mt-2 px-1 leading-4">
              Team points update automatically as matches are completed.
            </Text>
          ) : null}
        </View>

        {/* Current round match scorecards */}
        <View className="flex-1 min-w-0 min-h-0">
          <TournamentLiveMatchGrids
            matchGroups={matchGroups}
            scores={scores}
            teamNameById={teamNameById}
            playerNameById={playerNameById}
            useNetScoring={matchUseNetScoring}
            variant="tv-compact"
            roundNumber={displayRound}
            hideTitle
            layout="tv-carousel"
          />
        </View>

        {/* Sponsors */}
        {isLandscape && data.sponsors.sidebar.length > 0 ? (
          <View className="w-40 shrink-0 border-l border-neutral-800 pl-3 justify-center">
            <Text className="text-neutral-600 text-[9px] uppercase tracking-widest mb-2">
              Presented by
            </Text>
            <TvSponsorCarousel sponsors={data.sponsors.sidebar} />
          </View>
        ) : null}
      </View>

      {/* Footer */}
      <View className="border-t border-neutral-800 bg-[#111111] px-5 py-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-3 min-w-0">
            {data.sponsors.footer.length > 0 ? (
              <TvSponsorCarousel sponsors={data.sponsors.footer} variant="footer" />
            ) : (
              <Text className="text-neutral-600 text-xs">Fox Creek Golf Club · Dieppe, NB</Text>
            )}
          </View>

          {qrUrl ? (
            <View className="flex-row items-center shrink-0">
              <Image source={{ uri: qrUrl }} style={{ width: 56, height: 56 }} />
              <Text className="text-neutral-500 text-[9px] ml-2 max-w-[80px]">
                Scan for app
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
