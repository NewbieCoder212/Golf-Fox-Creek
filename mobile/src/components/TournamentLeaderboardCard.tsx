import { useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Trophy, ChevronRight } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { TournamentTeamMatchupBoard } from '@/components/TournamentTeamMatchupBoard';
import { TournamentRoundMatchList } from '@/components/TournamentRoundMatchList';
import {
  buildMatchPointsLeaderboardFromHoleResults,
  getTournamentById,
  getTournamentScores,
  getTournamentTeams,
} from '@/lib/tournament-service';
import { buildRoundSessionPointsLeaderboard } from '@/lib/tournament-session-scoring';
import { useTournamentMatchGroupsQuery } from '@/hooks/useTournamentMatchGroupsQuery';
import { buildTournamentPlayerMaps, getTournamentPlayers } from '@/lib/tournament-player-service';
import { getMatchHoleResultsForTournament } from '@/lib/tournament-match-service';
import { getMembersForChallenge } from '@/lib/social-service';
import { formatTournamentDates, getTeamSideDisplayName } from '@/lib/tournament-labels';
import { getActiveRoundNumber } from '@/lib/tournament-scorecard-routing';
import { cn } from '@/lib/cn';

interface TournamentLeaderboardCardProps {
  tournamentId: string;
  compact?: boolean;
  hubEmbedded?: boolean;
}

export function TournamentLeaderboardCard({
  tournamentId,
  compact = false,
  hubEmbedded = false,
}: TournamentLeaderboardCardProps) {
  const router = useRouter();

  const { data: tournament, isPending: tournamentPending, isError: tournamentError } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => getTournamentById(tournamentId),
    enabled: Boolean(tournamentId),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['tournamentTeams', tournamentId],
    queryFn: () => getTournamentTeams(tournamentId),
    enabled: Boolean(tournamentId),
  });

  const { data: matchGroups = [], isFetching: groupsFetching } = useTournamentMatchGroupsQuery(
    tournamentId,
    { refetchInterval: hubEmbedded ? 30_000 : 15_000 }
  );

  const { data: tournamentPlayers = [] } = useQuery({
    queryKey: ['tournamentPlayers', tournamentId],
    queryFn: () => getTournamentPlayers(tournamentId),
    enabled: Boolean(tournamentId) && hubEmbedded,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['membersForTeam'],
    queryFn: getMembersForChallenge,
    enabled: hubEmbedded,
  });

  const { data: holeResults = [] } = useQuery({
    queryKey: ['matchHoleResults', 'tournament', tournamentId],
    queryFn: () => getMatchHoleResultsForTournament(tournamentId),
    enabled: Boolean(tournamentId),
    refetchInterval: hubEmbedded ? 30_000 : 15_000,
  });

  const { data: scores = [] } = useQuery({
    queryKey: ['tournamentScores', tournamentId],
    queryFn: () => getTournamentScores(tournamentId),
    enabled: Boolean(tournamentId) && hubEmbedded,
    refetchInterval: hubEmbedded ? 30_000 : 15_000,
  });

  const playerNameById = useMemo(
    () => buildTournamentPlayerMaps(tournamentPlayers, members).nameById,
    [tournamentPlayers, members]
  );

  const matchUseNetScoring = tournament?.match_use_net_scoring ?? false;

  const standings = useMemo(
    () =>
      buildMatchPointsLeaderboardFromHoleResults(teams, matchGroups, holeResults, {
        scores,
        useNetScoring: matchUseNetScoring,
        tournament,
      }),
    [holeResults, teams, matchGroups, scores, matchUseNetScoring, tournament]
  );

  const activeRound = tournament ? getActiveRoundNumber(tournament) : 1;
  const roundMatchGroups = useMemo(
    () => matchGroups.filter((group) => group.round_number === activeRound),
    [matchGroups, activeRound]
  );

  const sessionStandings = useMemo(() => {
    if (!tournament) return [];
    const sideAName = getTeamSideDisplayName('side_a', teams);
    const sideBName = getTeamSideDisplayName('side_b', teams);
    return buildRoundSessionPointsLeaderboard(
      teams,
      roundMatchGroups,
      holeResults,
      tournament,
      sideAName,
      sideBName,
      scores,
      matchUseNetScoring
    );
  }, [teams, roundMatchGroups, holeResults, tournament, scores, matchUseNetScoring]);

  const overallTeamStats = standings.map((row) => ({
    teamId: row.teamId,
    matchPoints: row.matchPoints,
    matchesWon: row.matchesWon,
  }));
  const sessionTeamStats = sessionStandings.map((row) => ({
    teamId: row.teamId,
    matchPoints: row.matchPoints,
    matchesWon: row.matchesWon,
  }));
  const isLoading = tournamentPending;

  const openTournament = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (hubEmbedded) {
      router.push(`/tournaments/${tournamentId}?tab=standings`);
      return;
    }
    router.push(`/tournaments/${tournamentId}?tab=standings`);
  };

  if (isLoading) {
    return (
      <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-5 items-center">
        <ActivityIndicator color="#a3e635" />
      </View>
    );
  }

  if (tournamentError || !tournament) {
    return (
      <View className="bg-[#141414] rounded-2xl border border-neutral-800 p-4">
        <Text className="text-neutral-400 text-sm text-center">
          Standings unavailable right now.
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={openTournament}
      className={cn(
        'bg-[#141414] rounded-2xl border border-neutral-800 overflow-hidden active:opacity-90'
      )}
    >
      {!hubEmbedded ? (
        <View className="px-4 py-3 border-b border-neutral-800 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Trophy size={18} color="#a3e635" />
            <View className="ml-2 flex-1">
              <Text className="text-white font-bold" numberOfLines={1}>
                {tournament.name}
              </Text>
              {!compact && (
                <Text className="text-neutral-500 text-xs mt-0.5">
                  {formatTournamentDates(tournament.start_date, tournament.end_date)}
                </Text>
              )}
            </View>
          </View>
          <ChevronRight size={18} color="#525252" />
        </View>
      ) : null}

      <View className="p-3 relative">
        {groupsFetching && hubEmbedded ? (
          <View className="absolute top-2 right-2 z-10">
            <ActivityIndicator size="small" color="#a3e635" />
          </View>
        ) : null}
        {hubEmbedded ? (
          <>
            <Text className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2 px-1">
              Overall Standings
            </Text>
            <TournamentTeamMatchupBoard
              teams={teams}
              teamStats={overallTeamStats}
              compact={compact}
              minimal
              hubEmbedded
              className="border-0 bg-transparent mb-3"
            />
            <Text className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2 px-1">
              Current session score
            </Text>
            <TournamentTeamMatchupBoard
              teams={teams}
              teamStats={sessionTeamStats}
              compact={compact}
              minimal
              className="border-0 bg-transparent"
            />
          </>
        ) : (
          <TournamentTeamMatchupBoard
            teams={teams}
            teamStats={overallTeamStats}
            subtitle="Team Matchup"
            compact={compact}
            minimal={hubEmbedded}
            hubEmbedded={hubEmbedded}
            className="border-0 bg-transparent"
          />
        )}
        {hubEmbedded && tournament ? (
          <TournamentRoundMatchList
            tournament={tournament}
            teams={teams}
            matchGroups={matchGroups}
            playerNameById={playerNameById}
            scores={scores}
            useNetScoring={matchUseNetScoring}
            compact
            className="mt-3 pt-3 border-t border-neutral-800/60"
          />
        ) : null}
        {standings.length === 0 ? (
          <Text
            className={cn(
              'text-neutral-500 text-sm text-center px-2',
              hubEmbedded ? 'mt-1' : 'mt-2'
            )}
          >
            Teams will appear here once match play begins.
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
