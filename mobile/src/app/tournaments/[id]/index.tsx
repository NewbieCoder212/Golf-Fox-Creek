import { useState, useEffect, useCallback, useRef } from 'react';
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
import { canAccessAdminRole } from '@/lib/admin-auth-bridge';
import {
  getTeamsForPlayer,
  getTournamentById,
  getTournamentTeams,
  isUserRegisteredForTournament,
} from '@/lib/tournament-service';
import { getMembersForChallenge } from '@/lib/social-service';
import {
  formatTournamentDates,
  tournamentHasSinglesRound,
} from '@/lib/tournament-labels';
import { TournamentMyMatchTab } from '@/components/TournamentMyMatchTab';
import { TournamentTeeTimesTab } from '@/components/TournamentTeeTimesTab';
import { TournamentMatchGroupsTab } from '@/components/TournamentMatchGroupsTab';
import { useTournamentMatchGroupsQuery } from '@/hooks/useTournamentMatchGroupsQuery';
import { TournamentDataLoadError } from '@/components/TournamentDataLoadError';
import {
  buildTournamentPlayerMaps,
  getTournamentPlayers,
  getTournamentRosterPlayerIdsForUser,
} from '@/lib/tournament-player-service';
import {
  findMatchGroupForRosterPlayer,
  getActiveRoundNumber,
  resolveTournamentScorecardRoute,
} from '@/lib/tournament-scorecard-routing';
import { useScorecardTimeGate } from '@/hooks/useScorecardTimeGate';
import { cn } from '@/lib/cn';
import { TournamentTabAdBanner } from '@/components/TournamentTabAdBanner';
import { TournamentDetailAdBanner } from '@/components/TournamentDetailAdBanner';
import { TournamentCopyTvLinkButton } from '@/components/TournamentCopyTvLinkButton';
import { TournamentTeamsRosterTab } from '@/components/TournamentTeamsRosterTab';
import { TournamentLiveStandingsPanel } from '@/components/TournamentLiveStandingsPanel';
import { TournamentEventMatchActions } from '@/components/TournamentEventMatchActions';

type DetailTab = 'schedule' | 'match' | 'matches' | 'teams' | 'standings';

function parseTabParam(param: string | string[] | undefined): DetailTab | null {
  const raw = Array.isArray(param) ? param[0] : param;
  if (
    raw === 'teams' ||
    raw === 'schedule' ||
    raw === 'match' ||
    raw === 'matches' ||
    raw === 'standings'
  ) {
    return raw;
  }
  return null;
}

export default function TournamentDetailScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useMemberAuthStore((s) => s.user);
  const profile = useMemberAuthStore((s) => s.profile);
  const memberAccessToken = useMemberAuthStore((s) => s.accessToken);
  const isManager = canAccessAdminRole(profile?.role);
  const viewAllTournaments = isManager;
  const managerAccessToken = memberAccessToken;

  const [tab, setTab] = useState<DetailTab>(() => parseTabParam(tabParam) ?? 'standings');
  const [isOpeningScorecard, setIsOpeningScorecard] = useState(false);
  const [isUserRefreshing, setIsUserRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const tabSectionY = useRef(0);

  useEffect(() => {
    const parsed = parseTabParam(tabParam);
    if (parsed) setTab(parsed);
  }, [tabParam]);

  const { data: tournament, isLoading, refetch } = useQuery({
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

  const {
    data: matchGroups = [],
    isError: matchGroupsError,
    error: matchGroupsLoadError,
    refetch: refetchMatchGroups,
  } = useTournamentMatchGroupsQuery(id, { refetchInterval: 15_000 });

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

  const hasRosterAccess =
    isManager ||
    myTeams.length > 0 ||
    (tournament ? tournamentHasSinglesRound(tournament) : false);

  const { open: scoreEntryOpen, hint: scorecardClosedHint } = useScorecardTimeGate({
    tournament: tournament ?? { start_date: '', end_date: '' },
    matchGroup: myMatchAssignment?.group ?? null,
    bypassTimeGate: isManager,
  });

  const scorecardTimeHint =
    hasRosterAccess && !scoreEntryOpen ? scorecardClosedHint : null;

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

  const handlePullRefresh = useCallback(async () => {
    setIsUserRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsUserRefreshing(false);
    }
  }, [refetch]);

  const goToStandings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTab('standings');
    router.setParams({ tab: 'standings' });
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, tabSectionY.current - 8),
        animated: true,
      });
    });
  }, [router]);

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
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isUserRefreshing}
            onRefresh={() => void handlePullRefresh()}
            tintColor="#a3e635"
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View
          style={{ paddingTop: insets.top }}
          className="bg-[#141414] border-b border-neutral-800"
        >
          <View className="flex-row items-center px-4 py-2">
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

          <View className="px-5 pb-3">
            <TournamentDetailAdBanner />
          </View>

          <View className="px-5 pb-4">
            {myMatchAssignment && tournament ? (
              <TournamentEventMatchActions
                tournament={tournament}
                group={myMatchAssignment.group}
                viewerSide={myMatchAssignment.side}
                roundNumber={activeRoundNumber}
                rosterPlayerIds={myRosterPlayerIds}
                teams={teams}
                playerNameById={playerNameById}
                scoreEntryOpen={scoreEntryOpen}
                scorecardClosedHint={scorecardTimeHint}
                isOpeningScorecard={isOpeningScorecard}
                onEnterScores={() => void handleEnterScores()}
                onViewStandings={goToStandings}
              />
            ) : (
              <>
                {scorecardTimeHint ? (
                  <Text className="text-neutral-500 text-xs text-center mb-3 px-2">
                    {scorecardTimeHint}
                  </Text>
                ) : null}
                <Pressable
                  onPress={() => void handleEnterScores()}
                  disabled={!hasRosterAccess || isOpeningScorecard}
                  className={cn(
                    'flex-row items-center justify-center rounded-xl py-4',
                    hasRosterAccess ? 'bg-lime-600 active:opacity-80' : 'bg-neutral-800 opacity-50'
                  )}
                >
                  {isOpeningScorecard ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <ClipboardList size={20} color="#fff" />
                      <Text className="text-white font-bold text-base ml-2">
                        {scoreEntryOpen ? 'Enter scores' : 'Open scorecard'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>

          <View className="px-5 pb-3">
            <Text className="text-white text-xl font-bold">{tournament.name}</Text>
            <Text className="text-neutral-400 text-sm mt-0.5">
              {formatTournamentDates(tournament.start_date, tournament.end_date)}
            </Text>
          </View>

          {isManager && tournament.display_token ? (
            <View className="px-5 pb-3">
              <TournamentCopyTvLinkButton
                tournamentId={tournament.id}
                displayToken={tournament.display_token}
                displaySlug={tournament.display_slug}
                compact
              />
            </View>
          ) : null}
        </View>

        <View className="bg-[#141414] border-b border-neutral-800 z-10">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mx-5 my-3"
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 8 }}
          >
            {[
              { key: 'standings' as const, label: 'Standings', Icon: Trophy },
              { key: 'schedule' as const, label: 'Schedule', Icon: Clock },
              { key: 'match' as const, label: 'Match', Icon: Swords },
              ...(isManager
                ? [{ key: 'matches' as const, label: 'Matches', Icon: ClipboardList }]
                : []),
              { key: 'teams' as const, label: 'Teams', Icon: Users },
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

        <View
          className="pt-4"
          onLayout={(event) => {
            tabSectionY.current = event.nativeEvent.layout.y;
          }}
        >
          {matchGroupsError && (tab === 'schedule' || tab === 'match' || tab === 'standings') ? (
            <View className="px-5 mb-4">
              <TournamentDataLoadError
                title="Could not load tee times"
                message={
                  matchGroupsLoadError instanceof Error
                    ? matchGroupsLoadError.message
                    : 'Try logging in again.'
                }
                onRetry={() => void refetchMatchGroups()}
              />
            </View>
          ) : null}
          {tab === 'schedule' ? (
            <>
              <View className="px-5 mb-4">
                <TournamentTabAdBanner tab="schedule" />
              </View>
              <TournamentTeeTimesTab
              tournamentId={id!}
              tournament={tournament}
              teams={teams}
              playerNameById={playerNameById}
              matchGroups={matchGroups}
              defaultRoundNumber={activeRoundNumber}
            />
            </>
          ) : tab === 'match' && user?.id ? (
            <>
              <View className="px-5 mb-4">
                <TournamentTabAdBanner tab="match" />
              </View>
              <TournamentMyMatchTab
              tournamentId={id!}
              userId={user.id}
              tournament={tournament}
              teams={teams}
              matchGroups={matchGroups}
              rosterPlayerIds={myRosterPlayerIds}
              playerNameById={playerNameById}
              defaultRoundNumber={activeRoundNumber}
              bypassScorecardTimeGate={isManager}
              onViewStandings={goToStandings}
            />
            </>
          ) : tab === 'matches' && isManager ? (
            <TournamentMatchGroupsTab
              tournamentId={id!}
              tournament={tournament}
              teams={teams}
              members={members}
              playerNameById={playerNameById}
              isManager={isManager}
            />
          ) : tab === 'standings' ? (
            <>
              <View className="px-5 mb-4">
                <TournamentTabAdBanner tab="standings" />
              </View>
              <View className="px-5">
                <TournamentLiveStandingsPanel
                  tournamentId={id!}
                  displayToken={isManager ? tournament.display_token : null}
                  showTvLink={isManager}
                  compact
                />
              </View>
            </>
          ) : tab === 'teams' ? (
            <>
              <View className="px-5 mb-4">
                <TournamentTabAdBanner tab="teams" />
              </View>
              <View className="px-5" style={{ minHeight: 420 }}>
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
                layout="hero"
                introText={
                  isManager
                    ? 'Managers can also build rosters from Admin → Tournaments → Teams. No onboarding emails are sent from this screen.'
                    : undefined
                }
              />
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
