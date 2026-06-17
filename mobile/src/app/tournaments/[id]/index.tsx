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
  Clock,
  Swords,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';

import { useMemberAuthStore } from '@/lib/member-auth-store';
import { useAdminAuthStore } from '@/lib/admin-auth-store';
import {
  getTeamsForPlayer,
  getTournamentById,
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
import { getTournamentMatchGroups } from '@/lib/tournament-match-service';
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
import { cn } from '@/lib/cn';
import { TournamentCopyTvLinkButton } from '@/components/TournamentCopyTvLinkButton';
import { TournamentLiveStandingsPanel } from '@/components/TournamentLiveStandingsPanel';
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

  const { data: matchGroups = [] } = useQuery({
    queryKey: ['tournamentMatchGroups', id],
    queryFn: () => getTournamentMatchGroups(id!),
    enabled: Boolean(id),
    refetchInterval: 15000,
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
            <TournamentLiveStandingsPanel tournamentId={id!} showSponsorBanner />
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
