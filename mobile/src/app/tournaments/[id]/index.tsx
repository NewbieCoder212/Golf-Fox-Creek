import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Trophy,
  Users,
  ClipboardList,
  Medal,
  Clock,
  Swords,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';

import { useMemberAuthStore } from '@/lib/member-auth-store';
import { useAdminAuthStore } from '@/lib/admin-auth-store';
import {
  buildMatchPointsLeaderboard,
  buildTournamentLeaderboard,
  getTeamsForPlayer,
  getTournamentById,
  getTournamentScores,
  getTournamentTeams,
  isUserRegisteredForTournament,
} from '@/lib/tournament-service';
import { getMembersForChallenge } from '@/lib/social-service';
import {
  formatLabel,
  formatTournamentDates,
  tournamentHasSinglesRound,
} from '@/lib/tournament-labels';
import { TournamentTeeTimesTab } from '@/components/TournamentTeeTimesTab';
import { TournamentMatchGroupsTab } from '@/components/TournamentMatchGroupsTab';
import {
  getTeamBySide,
  getMatchHoleResultsForTournament,
  getTournamentMatchGroups,
} from '@/lib/tournament-match-service';
import { aggregateEventHoleWins } from '@/lib/tournament-match-scoring';
import {
  buildTournamentPlayerMaps,
  getTournamentPlayers,
  getTournamentRosterPlayerIdsForUser,
} from '@/lib/tournament-player-service';
import {
  findMatchGroupForRosterPlayer,
  formatTeeTimeLabel,
  getActiveRoundNumber,
  resolveTournamentScorecardRoute,
} from '@/lib/tournament-scorecard-routing';
import {
  useTournamentLeaderboardMode,
  useTournamentStore,
} from '@/lib/tournament-store';
import { cn } from '@/lib/cn';
import { SponsorBanner } from '@/components/SponsorBanner';
import { TournamentCopyTvLinkButton } from '@/components/TournamentCopyTvLinkButton';
import { TournamentTeamMatchupBoard } from '@/components/TournamentTeamMatchupBoard';
import { TournamentTeamsRosterTab } from '@/components/TournamentTeamsRosterTab';

type DetailTab = 'leaderboard' | 'teams' | 'matches' | 'teeTimes';

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useMemberAuthStore((s) => s.user);
  const profile = useMemberAuthStore((s) => s.profile);
  const memberAccessToken = useMemberAuthStore((s) => s.accessToken);
  const adminAccessToken = useAdminAuthStore((s) => s.accessToken);
  const canAccessAdmin = useAdminAuthStore((s) => s.canAccessAdmin);
  const isManager =
    profile?.role === 'manager' ||
    profile?.role === 'super_admin' ||
    canAccessAdmin();
  const viewAllTournaments = isManager;
  const managerAccessToken = adminAccessToken ?? memberAccessToken;

  const [tab, setTab] = useState<DetailTab>('leaderboard');
  const [isOpeningScorecard, setIsOpeningScorecard] = useState(false);

  const { data: tournament, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => getTournamentById(id!),
    enabled: Boolean(id),
  });

  const { data: hasAccess = viewAllTournaments, isLoading: isCheckingAccess } = useQuery({
    queryKey: ['tournamentAccess', id, user?.id, viewAllTournaments],
    queryFn: async () => {
      if (viewAllTournaments || !user?.id || !id) return true;
      return isUserRegisteredForTournament(user.id, id);
    },
    enabled: Boolean(id && user?.id),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['tournamentTeams', id],
    queryFn: () => getTournamentTeams(id!),
    enabled: Boolean(id),
  });

  const sideATeam = getTeamBySide(teams, 'side_a');
  const sideBTeam = getTeamBySide(teams, 'side_b');

  const { data: scores = [] } = useQuery({
    queryKey: ['tournamentScores', id],
    queryFn: () => getTournamentScores(id!),
    enabled: Boolean(id),
  });

  const { data: myTeams = [] } = useQuery({
    queryKey: ['myTeams', id, user?.id],
    queryFn: () => getTeamsForPlayer(id!, user!.id),
    enabled: Boolean(id && user?.id),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['membersForTeam'],
    queryFn: getMembersForChallenge,
  });

  const { data: tournamentPlayers = [] } = useQuery({
    queryKey: ['tournamentPlayers', id],
    queryFn: () => getTournamentPlayers(id!),
    enabled: Boolean(id),
  });

  const { data: matchHoleResults = [] } = useQuery({
    queryKey: ['matchHoleResults', id],
    queryFn: () => getMatchHoleResultsForTournament(id!),
    enabled: Boolean(id && sideATeam && sideBTeam),
  });

  const { data: matchGroups = [] } = useQuery({
    queryKey: ['tournamentMatchGroups', id],
    queryFn: () => getTournamentMatchGroups(id!),
    enabled: Boolean(id),
  });

  const { data: myRosterPlayerIds = [] } = useQuery({
    queryKey: ['myRosterPlayerIds', id, user?.id],
    queryFn: () => getTournamentRosterPlayerIdsForUser(id!, user!.id),
    enabled: Boolean(id && user?.id),
  });

  const activeRoundNumber = tournament ? getActiveRoundNumber(tournament) : 1;
  const myMatchAssignment = tournament
    ? findMatchGroupForRosterPlayer(matchGroups, myRosterPlayerIds, activeRoundNumber)
    : null;

  const matchPointsLeaderboard = buildMatchPointsLeaderboard(teams, matchGroups);

  const eventHoleWins = aggregateEventHoleWins(matchHoleResults);
  const hasMatchResults = matchHoleResults.length > 0;

  const leaderboardMode = useTournamentLeaderboardMode();
  const setLeaderboardMode = useTournamentStore((s) => s.setLeaderboardMode);

  const leaderboard = buildTournamentLeaderboard(scores, leaderboardMode);
  const teamNameById = Object.fromEntries(teams.map((t) => [t.id, t.team_name]));
  const { nameById: playerNameById } = buildTournamentPlayerMaps(tournamentPlayers, members);

  const canEnterScores =
    isManager ||
    myTeams.length > 0 ||
    (tournament ? tournamentHasSinglesRound(tournament) : false);

  const handleEnterScores = async () => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsOpeningScorecard(true);

    try {
      const route =
        user?.id && myRosterPlayerIds.length > 0
          ? await resolveTournamentScorecardRoute(id, user.id)
          : `/(tabs)/scorecard?id=${id}&round=${activeRoundNumber}`;
      router.push(route as never);
    } finally {
      setIsOpeningScorecard(false);
    }
  };

  if (isLoading || isCheckingAccess || !tournament) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center">
        <ActivityIndicator size="large" color="#a3e635" />
      </View>
    );
  }

  if (!hasAccess) {
    return (
      <View className="flex-1 bg-[#0c0c0c]">
        <View style={{ paddingTop: insets.top }} className="px-4 py-3">
          <Pressable onPress={() => router.back()} className="flex-row items-center active:opacity-60">
            <ChevronLeft size={24} color="#a3e635" />
            <Text className="text-lime-400 text-base font-medium ml-1">Back</Text>
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Trophy size={48} color="#525252" />
          <Text className="text-white text-xl font-bold mt-4 text-center">Not registered</Text>
          <Text className="text-neutral-400 text-sm text-center mt-2">
            You are not on the roster for {tournament.name}. Contact the pro shop to be added to a
            team.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <View style={{ paddingTop: insets.top }} className="bg-[#141414] border-b border-neutral-800">
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="flex-row items-center active:opacity-60 py-1"
          >
            <ChevronLeft size={24} color="#a3e635" />
            <Text className="text-lime-400 text-base font-medium ml-1">Back</Text>
          </Pressable>
        </View>

        <View className="px-5 pb-4">
          <Text className="text-white text-2xl font-bold">{tournament.name}</Text>
          <Text className="text-neutral-400 text-sm mt-1">
            {formatTournamentDates(tournament.start_date, tournament.end_date)}
          </Text>
          <View className="flex-row flex-wrap gap-2 mt-3">
            {tournament.round_schedule.map((day, dayIndex) => (
              <View
                key={`${tournament.id}-day-${dayIndex}`}
                className="bg-lime-900/30 border border-lime-700/40 rounded-full px-3 py-1"
              >
                <Text className="text-lime-400 text-xs font-semibold">
                  Day {dayIndex + 1}:{' '}
                  {day.formats.map((format) => formatLabel(format)).join(', ')}
                </Text>
              </View>
            ))}
            <View className="bg-neutral-800 rounded-full px-3 py-1">
              <Text className="text-neutral-400 text-xs font-medium">
                {tournament.rounds_count} rounds
              </Text>
            </View>
          </View>
          {isManager && tournament.display_token ? (
            <View className="mt-4">
              <TournamentCopyTvLinkButton
                tournamentId={tournament.id}
                displayToken={tournament.display_token}
              />
            </View>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mx-5 mb-4"
          contentContainerStyle={{ gap: 8 }}
        >
          {[
            { key: 'leaderboard' as const, label: 'Standings', Icon: Trophy },
            { key: 'teams' as const, label: 'Teams', Icon: Users },
            { key: 'matches' as const, label: 'Matches', Icon: Swords },
            { key: 'teeTimes' as const, label: 'Tee Times', Icon: Clock },
          ].map(({ key, label, Icon }) => (
            <Pressable
              key={key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTab(key);
              }}
              className={cn(
                'px-4 py-2.5 rounded-lg border flex-row items-center gap-1.5',
                tab === key
                  ? 'bg-lime-600 border-lime-600'
                  : 'bg-[#0c0c0c] border-neutral-800'
              )}
            >
              <Icon size={16} color={tab === key ? '#fff' : '#737373'} />
              <Text
                className={cn(
                  'text-xs font-medium',
                  tab === key ? 'text-white' : 'text-neutral-500'
                )}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#a3e635" />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {tab === 'leaderboard' ? (
          <View className="mx-5">
            <SponsorBanner
              placementType="leaderboard"
              displayPosition="footer"
              className="mt-2 mb-1"
              compact
            />

            {sideATeam && sideBTeam && (
              <TournamentTeamMatchupBoard
                teams={teams}
                teamStats={matchPointsLeaderboard.map((row) => ({
                  teamId: row.teamId,
                  matchPoints: row.matchPoints,
                  matchesWon: row.matchesWon,
                }))}
                subtitle="Team Matchup"
                className="mt-2 mb-3"
              />
            )}

            {hasMatchResults && sideATeam && sideBTeam && (
              <View className="bg-[#141414] rounded-2xl border border-lime-700/40 p-4 mt-2 mb-1">
                <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                  Team Match Play
                </Text>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 items-center">
                    <Text className="text-lime-400 text-xs font-bold uppercase mb-1">
                      {sideATeam.team_name}
                    </Text>
                    <Text className="text-white text-3xl font-bold">{eventHoleWins.side_a}</Text>
                    <Text className="text-neutral-500 text-xs">holes won</Text>
                  </View>
                  <Text className="text-neutral-600 text-lg font-bold px-3">vs</Text>
                  <View className="flex-1 items-center">
                    <Text className="text-lime-400 text-xs font-bold uppercase mb-1">
                      {sideBTeam.team_name}
                    </Text>
                    <Text className="text-white text-3xl font-bold">{eventHoleWins.side_b}</Text>
                    <Text className="text-neutral-500 text-xs">holes won</Text>
                  </View>
                </View>
                {eventHoleWins.ties > 0 && (
                  <Text className="text-neutral-500 text-xs text-center mt-2">
                    {eventHoleWins.ties} holes tied across all matches
                  </Text>
                )}
              </View>
            )}

            <View className="flex-row bg-[#141414] rounded-xl border border-neutral-800 p-1 mt-2 mb-1">
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
              <View className="py-12 items-center bg-[#141414] rounded-2xl border border-neutral-800 mt-2">
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
          </View>
        ) : tab === 'teams' ? (
          <View className="mx-5">
            <TournamentTeamsRosterTab
              tournamentId={id!}
              tournament={tournament}
              teams={teams}
              members={members}
              tournamentPlayers={tournamentPlayers}
              playerNameById={playerNameById}
              isManager={isManager}
              userId={user?.id}
              accessToken={managerAccessToken}
              introText={
                isManager
                  ? 'Managers can also build rosters from Admin → Tournaments → Teams. No onboarding emails are sent from this screen.'
                  : undefined
              }
            />
          </View>
        ) : tab === 'matches' ? (
          <TournamentMatchGroupsTab
            tournamentId={id!}
            tournament={tournament}
            teams={teams}
            members={members}
            playerNameById={playerNameById}
            isManager={isManager}
          />
        ) : tab === 'teeTimes' ? (
          <TournamentTeeTimesTab
            tournamentId={id!}
            tournament={tournament}
            teams={teams}
            members={members}
            isManager={isManager}
          />
        ) : null}
      </ScrollView>

      <View
        style={{ paddingBottom: insets.bottom + 12 }}
        className="absolute bottom-0 left-0 right-0 bg-[#141414] border-t border-neutral-800 px-5 pt-4"
      >
        {myMatchAssignment && (
          <View className="bg-lime-900/20 border border-lime-700/40 rounded-xl px-3 py-2 mb-3">
            <Text className="text-lime-400 text-xs font-semibold">
              Your group · Tee {formatTeeTimeLabel(myMatchAssignment.group.tee_time)} · Hole{' '}
              {myMatchAssignment.group.starting_hole}
            </Text>
            <Text className="text-neutral-500 text-[11px] mt-0.5">
              Scorecard opens with your foursome and pairings
            </Text>
          </View>
        )}
        <Pressable
          onPress={handleEnterScores}
          disabled={!canEnterScores || isOpeningScorecard}
          className={cn(
            'flex-row items-center justify-center rounded-xl py-3.5',
            canEnterScores ? 'bg-lime-600 active:opacity-80' : 'bg-neutral-800 opacity-50'
          )}
        >
          {isOpeningScorecard ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <ClipboardList size={18} color="#fff" />
              <Text className="text-white font-bold ml-2">Enter Scores</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
