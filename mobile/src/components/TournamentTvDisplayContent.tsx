import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Trophy, Radio } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTournamentDisplayRealtime } from '@/hooks/useTournamentDisplayRealtime';
import { formatTournamentDates, formatRoundPickerLabel } from '@/lib/tournament-labels';
import { formatClubTime } from '@/lib/club-timezone';
import {
  TvFooterSponsorStrip,
  TvSidebarSponsorStack,
  TvSponsorSlot,
} from '@/components/TvSponsorSlot';
import { TournamentLiveMatchGrids } from '@/components/TournamentLiveMatchGrids';
import { TournamentTeamMatchupBoard } from '@/components/TournamentTeamMatchupBoard';
import { TournamentTvChampionsBanner } from '@/components/TournamentTvChampionsBanner';
import { TournamentTvTeeSheet } from '@/components/TournamentTvTeeSheet';
import { buildTournamentPlayerMaps } from '@/lib/tournament-player-service';
import { getTeamBySide } from '@/lib/tournament-match-service';
import { buildMatchPointsLeaderboardFromHoleResults } from '@/lib/tournament-service';
import { getTvDisplayRoundNumber, getTournamentTvChampion, isTournamentTvComplete } from '@/lib/tournament-tv-display';
import {
  buildTournamentTeeSheetRows,
  resolveTvTeeSheetRound,
  summarizeTvLiveEmptyState,
} from '@/lib/tournament-tee-sheet';
import type { Tournament, TournamentDisplayPayload, TournamentPlayer, TournamentTeam } from '@/types';

const TV_WIDE_MIN_WIDTH = 860;

interface TournamentTvDisplayContentProps {
  tournamentId: string | undefined;
  data: TournamentDisplayPayload | undefined;
  isLoading: boolean;
  error: Error | null;
  isFetching: boolean;
  dataUpdatedAt: number;
  onRefetch: () => void;
  invalidLinkMessage?: string;
  showInvalidLink?: boolean;
}

export function TournamentTvDisplayContent({
  tournamentId,
  data,
  isLoading,
  error,
  isFetching,
  dataUpdatedAt,
  onRefetch,
  invalidLinkMessage = 'Ask the pro shop for the TV display URL.',
  showInvalidLink = false,
}: TournamentTvDisplayContentProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isWideLayout = width >= TV_WIDE_MIN_WIDTH;
  const isLandscape = width > height;

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

  const { teeSheetRound, isPreviewingNextRound } = useMemo(() => {
    if (!tournament) {
      return { teeSheetRound: 1, isPreviewingNextRound: false };
    }
    return resolveTvTeeSheetRound({
      activeRound: displayRound,
      tournament,
      teams,
      matchGroups,
      holeResults,
      playerNameById,
    });
  }, [tournament, displayRound, teams, matchGroups, holeResults, playerNameById]);

  const roundLabel = useMemo(() => {
    if (!tournament) return `Round ${displayRound}`;
    return formatRoundPickerLabel(tournament, displayRound);
  }, [tournament, displayRound]);

  const currentRoundMatchGroups = useMemo(
    () => matchGroups.filter((group) => group.round_number === displayRound),
    [matchGroups, displayRound]
  );

  const matchUseNetScoring = tournament?.match_use_net_scoring ?? false;

  const liveEmptySummary = useMemo(() => {
    if (!tournament || matchGroups.length === 0) return null;
    const rows = buildTournamentTeeSheetRows({
      tournament,
      teams,
      matchGroups,
      holeResults,
      playerNameById,
      roundNumber: displayRound,
    });
    return summarizeTvLiveEmptyState(rows);
  }, [tournament, teams, matchGroups, holeResults, playerNameById, displayRound]);

  const hasTeeSheet = Boolean(tournament && matchGroups.length > 0);

  const tvLiveMaxHeight = useMemo(() => {
    if (!hasTeeSheet) return undefined;
    const reserved = insets.top + insets.bottom + 168;
    const mainHeight = Math.max(260, height - reserved);
    return Math.floor(mainHeight * 0.34);
  }, [hasTeeSheet, height, insets.top, insets.bottom]);

  const sideATeam = getTeamBySide(teams, 'side_a');
  const sideBTeam = getTeamBySide(teams, 'side_b');

  const teamStats = useMemo(() => {
    const pointsStats = buildMatchPointsLeaderboardFromHoleResults(
      teams,
      matchGroups,
      holeResults
    );

    return pointsStats.map((row) => ({
      teamId: row.teamId,
      matchPoints: row.matchPoints,
      matchesWon: row.matchesWon,
    }));
  }, [teams, matchGroups, holeResults]);

  const tournamentComplete = useMemo(() => {
    if (!tournament) return false;
    return isTournamentTvComplete({
      tournament,
      teams,
      matchGroups,
      holeResults,
      playerNameById,
    });
  }, [tournament, teams, matchGroups, holeResults, playerNameById]);

  const champion = useMemo(() => {
    if (!tournament || !tournamentComplete) return null;
    return getTournamentTvChampion({
      tournament,
      teams,
      matchGroups,
      holeResults,
    });
  }, [tournament, tournamentComplete, teams, matchGroups, holeResults]);

  const handleRealtimeUpdate = useCallback(() => {
    onRefetch();
  }, [onRefetch]);

  useTournamentDisplayRealtime(tournamentId, handleRealtimeUpdate);

  if (showInvalidLink) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center px-8">
        <Text className="text-white text-2xl font-bold text-center">Invalid display link</Text>
        <Text className="text-neutral-400 text-center mt-3">{invalidLinkMessage}</Text>
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
  const footerSponsors = data.sponsors.footer;
  const sidebarSponsors = data.sponsors.sidebar;
  const hasFooterAd = footerSponsors.length > 0;

  const teeSheet =
    hasTeeSheet && tournament ? (
      <TournamentTvTeeSheet
        tournament={tournament}
        teams={teams}
        matchGroups={matchGroups}
        holeResults={holeResults}
        playerNameById={playerNameById}
        roundNumber={teeSheetRound}
        isPreviewingNextRound={isPreviewingNextRound}
        compact={false}
      />
    ) : null;

  const standingsBoard =
    sideATeam && sideBTeam ? (
      <TournamentTeamMatchupBoard
        teams={teams}
        teamStats={teamStats}
        subtitle={tournamentComplete ? 'Final Standings · Match pts' : 'Live Standings · Match pts'}
        tvDisplay={isWideLayout}
        tvStrip={!isWideLayout}
      />
    ) : !sideATeam && !sideBTeam && currentRoundMatchGroups.length === 0 ? (
      <View className="py-8 items-center bg-[#141414] rounded-xl border border-neutral-800">
        <Trophy size={28} color="#525252" />
        <Text className="text-neutral-500 text-sm mt-3">No scores yet</Text>
      </View>
    ) : null;

  const championsBanner =
    champion != null ? (
      <TournamentTvChampionsBanner champion={champion} compact={!isWideLayout} />
    ) : null;

  return (
    <View
      className="flex-1 bg-[#0c0c0c] overflow-hidden"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="border-b border-neutral-800 bg-[#111111] px-5 py-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-3 min-w-0">
            {data.sponsors.header_left[0] && isLandscape ? (
              <View className="w-28 mr-3">
                <TvSponsorSlot sponsor={data.sponsors.header_left[0]} variant="header" />
              </View>
            ) : null}
            <View className="flex-1 min-w-0">
              <Text className="text-lime-400 font-semibold uppercase tracking-[0.2em] text-[10px]">
                Fox Creek Golf Club
              </Text>
              <Text className="text-white font-bold text-xl" numberOfLines={1}>
                {data.tournament.name}
              </Text>
              <Text className="text-lime-400 font-semibold mt-0.5 text-sm" numberOfLines={1}>
                {tournamentComplete ? 'Tournament Complete' : roundLabel}
              </Text>
              <Text className="text-neutral-500 text-xs" numberOfLines={1}>
                {formatTournamentDates(data.tournament.start_date, data.tournament.end_date)}
              </Text>
            </View>
          </View>

          <View className="items-end shrink-0">
            {tournamentComplete ? (
              <View className="flex-row items-center bg-amber-950/40 border border-amber-700/30 rounded-full px-2.5 py-1">
                <Trophy size={12} color="#facc15" />
                <Text className="text-amber-300 font-semibold ml-1 uppercase tracking-wider text-[10px]">
                  Final
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center bg-lime-950/40 border border-lime-700/30 rounded-full px-2.5 py-1">
                <Radio size={12} color="#a3e635" />
                <Text className="text-lime-400 font-semibold ml-1 uppercase tracking-wider text-[10px]">
                  Live
                </Text>
                {isFetching ? (
                  <ActivityIndicator size="small" color="#a3e635" style={{ marginLeft: 6 }} />
                ) : null}
              </View>
            )}
            <Text className="text-neutral-600 mt-1 text-[10px]">
              Updated {lastUpdated}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-1 min-h-0 px-4 py-3">
        {isWideLayout ? (
          <View className="flex-1 min-h-0 flex-row gap-4 overflow-hidden">
            <View className="w-[320px] shrink-0 gap-3">
              {championsBanner}
              {standingsBoard}
              {sidebarSponsors.length > 0 ? (
                <TvSidebarSponsorStack sponsors={sidebarSponsors} />
              ) : null}
            </View>

            <View className="flex-1 min-w-0 min-h-0 gap-2">
              <View className="shrink-0 overflow-hidden" style={tvLiveMaxHeight ? { maxHeight: tvLiveMaxHeight } : undefined}>
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
                  liveEmptySummary={liveEmptySummary}
                  tournamentComplete={tournamentComplete}
                  maxHeight={tvLiveMaxHeight}
                />
              </View>
              {teeSheet ? <View className="flex-1 min-h-0 shrink pt-0.5">{teeSheet}</View> : null}
            </View>
          </View>
        ) : (
          <View className="flex-1 min-h-0 gap-2">
            {championsBanner}
            {standingsBoard}

            <View className="shrink-0 overflow-hidden" style={tvLiveMaxHeight ? { maxHeight: tvLiveMaxHeight } : undefined}>
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
                liveEmptySummary={liveEmptySummary}
                tournamentComplete={tournamentComplete}
                maxHeight={tvLiveMaxHeight}
              />
            </View>
            {teeSheet ? <View className="flex-1 min-h-0 shrink pt-0.5">{teeSheet}</View> : null}
          </View>
        )}
      </View>

      <View className="border-t border-neutral-800 bg-[#111111] shrink-0 px-5 py-2.5">
        {hasFooterAd ? (
          <TvFooterSponsorStrip sponsors={footerSponsors} />
        ) : sidebarSponsors.length > 0 && !isWideLayout ? (
          <TvFooterSponsorStrip sponsors={sidebarSponsors} />
        ) : (
          <Text className="text-neutral-600 text-xs">Fox Creek Golf Club · Dieppe, NB</Text>
        )}
      </View>
    </View>
  );
}
