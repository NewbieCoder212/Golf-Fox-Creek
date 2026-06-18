import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  ImageIcon,
  Upload,
  Save,
  Trash2,
  Plus,
  Trophy,
  Users,
  Swords,
  BookOpen,
  UserRound,
  Mail,
  Medal,
} from 'lucide-react-native';

import { TournamentTeamMatchupBoard } from '@/components/TournamentTeamMatchupBoard';
import { TournamentLiveStandingsPanel } from '@/components/TournamentLiveStandingsPanel';
import { TournamentParticipantsTab } from '@/components/TournamentParticipantsTab';
import { TournamentTeamsAssignTab } from '@/components/TournamentTeamsAssignTab';
import { TournamentPublishTab } from '@/components/TournamentPublishTab';
import { AdminTournamentFormatsTab } from '@/components/admin/AdminTournamentFormatsTab';
import { TournamentMatchGroupsTab } from '@/components/TournamentMatchGroupsTab';
import { TournamentDataLoadError } from '@/components/TournamentDataLoadError';
import { TournamentHandicapFields } from '@/components/TournamentHandicapFields';
import {
  buildSchedulePayload,
  createEmptySchedule,
  TournamentScheduleEditor,
} from '@/components/TournamentScheduleEditor';
import {
  buildMatchPointsLeaderboard,
  createTournament,
  deleteTournament,
  getTournamentById,
  getTournamentsResult,
  getTournamentTeams,
  updateTournament,
  updateTournamentTeam,
} from '@/lib/tournament-service';
import { getTeamBySide } from '@/lib/tournament-match-service';
import { useTournamentMatchGroupsQuery } from '@/hooks/useTournamentMatchGroupsQuery';
import { buildTournamentPlayerMaps, getTournamentPlayers } from '@/lib/tournament-player-service';
import { getMembersForChallenge } from '@/lib/social-service';
import { pickTeamLogoImage, uploadTeamLogoImage } from '@/lib/team-logo-upload';
import { formatTournamentDates, toTournamentDateInputValue, tournamentDateInputToIso } from '@/lib/tournament-labels';
import { getActiveFormatIds } from '@/lib/tournament-format-settings';
import { useTournamentFormatsSettings } from '@/lib/useTournamentFormatsSettings';
import type { HandicapAllowancePct } from '@/lib/tournament-scoring';
import type { Tournament, TournamentDaySchedule, TournamentTeam } from '@/types';
import { useRouter } from 'expo-router';
import { cn } from '@/lib/cn';

type ManagementTab = 'event' | 'participants' | 'teams' | 'matches' | 'standings' | 'publish' | 'formats';

interface AdminTournamentManagementSectionProps {
  accessToken: string;
  onBack: () => void;
}

function TeamLogoUploadCard({
  team,
  accessToken,
  onUploaded,
  uploading,
  onUploadStart,
}: {
  team: TournamentTeam;
  accessToken: string;
  onUploaded: () => void;
  uploading: boolean;
  onUploadStart: (teamId: string) => void;
}) {
  const handleUpload = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const uri = await pickTeamLogoImage();
      if (!uri) return;

      onUploadStart(team.id);
      const uploadResult = await uploadTeamLogoImage(accessToken, team.id, uri);
      if (uploadResult.error || !uploadResult.data) {
        Alert.alert('Upload failed', uploadResult.error ?? 'Could not upload logo.');
        onUploadStart('');
        return;
      }

      const updateResult = await updateTournamentTeam(team.id, { logo_url: uploadResult.data });
      if (updateResult.error) {
        Alert.alert('Save failed', updateResult.error);
        onUploadStart('');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUploaded();
      onUploadStart('');
    } catch (error) {
      onUploadStart('');
      Alert.alert(
        'Upload failed',
        error instanceof Error ? error.message : 'Could not upload team logo.'
      );
    }
  };

  return (
    <View className="flex-row items-center mt-4 gap-4">
      {team.logo_url ? (
        <Image
          source={{ uri: team.logo_url }}
          className="w-14 h-14 rounded-full border border-neutral-700"
          resizeMode="cover"
        />
      ) : (
        <View className="w-14 h-14 rounded-full bg-neutral-900 border border-neutral-800 items-center justify-center">
          <ImageIcon size={20} color="#525252" />
        </View>
      )}

      <Pressable
        onPress={handleUpload}
        disabled={uploading}
        className="flex-1 flex-row items-center justify-center bg-neutral-800 rounded-xl py-2.5 active:opacity-80"
      >
        {uploading ? (
          <ActivityIndicator color="#a3e635" />
        ) : (
          <>
            <Upload size={14} color="#a3e635" />
            <Text className="text-lime-400 font-semibold text-sm ml-2">
              {team.logo_url ? 'Change Logo' : 'Upload Logo'}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

export function AdminTournamentManagementSection({
  accessToken,
  onBack,
}: AdminTournamentManagementSectionProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: formatSettings } = useTournamentFormatsSettings();
  const activeFormatIds = getActiveFormatIds(formatSettings);
  const [tab, setTab] = useState<ManagementTab>('event');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadingTeamId, setUploadingTeamId] = useState('');

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [schedule, setSchedule] = useState<TournamentDaySchedule[]>(createEmptySchedule);
  const [customFormatByKey, setCustomFormatByKey] = useState<Record<string, string>>({});
  const [handicapUseIndex, setHandicapUseIndex] = useState(true);
  const [handicapAllowancePct, setHandicapAllowancePct] = useState<HandicapAllowancePct>(100);
  const [matchUseNetScoring, setMatchUseNetScoring] = useState(false);

  const { data: tournaments = [], isLoading: tournamentsLoading, isError: tournamentsError, error: tournamentsLoadError, refetch: refetchTournaments } = useQuery({
    queryKey: ['adminTournaments'],
    queryFn: async () => {
      const result = await getTournamentsResult({ limit: 30 });
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data ?? [];
    },
  });

  useEffect(() => {
    if (!selectedTournamentId && tournaments.length > 0 && !isCreating) {
      setSelectedTournamentId(tournaments[0].id);
    }
  }, [tournaments, selectedTournamentId, isCreating]);

  const { data: selectedTournament, isLoading: tournamentLoading } = useQuery({
    queryKey: ['tournament', selectedTournamentId],
    queryFn: () => getTournamentById(selectedTournamentId!),
    enabled: Boolean(selectedTournamentId) && !isCreating,
  });

  useEffect(() => {
    if (!selectedTournament || isCreating) return;
    setName(selectedTournament.name);
    setStartDate(toTournamentDateInputValue(selectedTournament.start_date));
    setEndDate(toTournamentDateInputValue(selectedTournament.end_date));
    setSchedule(selectedTournament.round_schedule);
    setHandicapUseIndex(selectedTournament.handicap_use_index ?? true);
    setHandicapAllowancePct(
      (selectedTournament.handicap_allowance_pct ?? 100) as HandicapAllowancePct
    );
    setMatchUseNetScoring(selectedTournament.match_use_net_scoring ?? false);
  }, [selectedTournament, isCreating]);

  const tournamentId = isCreating ? null : selectedTournamentId;

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['tournamentTeams', tournamentId],
    queryFn: () => getTournamentTeams(tournamentId!),
    enabled: Boolean(tournamentId),
  });

  const { data: matchGroups = [] } = useTournamentMatchGroupsQuery(tournamentId);

  const { data: tournamentPlayers = [] } = useQuery({
    queryKey: ['tournamentPlayers', tournamentId],
    queryFn: () => getTournamentPlayers(tournamentId!),
    enabled: Boolean(tournamentId),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['membersForTeam'],
    queryFn: getMembersForChallenge,
  });

  const sideA = getTeamBySide(teams, 'side_a');
  const sideB = getTeamBySide(teams, 'side_b');
  const standings = buildMatchPointsLeaderboard(teams, matchGroups);
  const teamStats = standings.map((row) => ({
    teamId: row.teamId,
    matchPoints: row.matchPoints,
    matchesWon: row.matchesWon,
  }));

  const { nameById: playerNameById } = buildTournamentPlayerMaps(tournamentPlayers, members);

  const invalidateTournamentQueries = (id?: string | null) => {
    queryClient.invalidateQueries({ queryKey: ['adminTournaments'] });
    queryClient.invalidateQueries({ queryKey: ['adminLeaderboardTournament'] });
    queryClient.invalidateQueries({ queryKey: ['adminEventTeamsTournaments'] });
    queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    if (id) {
      queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      queryClient.invalidateQueries({ queryKey: ['tournamentTeams', id] });
      queryClient.invalidateQueries({ queryKey: ['tournamentMatchGroups', id] });
    }
  };

  const saveTournamentMutation = useMutation({
    mutationFn: async (creating: boolean) => {
      if (!name.trim() || !startDate || !endDate) {
        throw new Error('Name and dates are required.');
      }

      const payload = {
        name: name.trim(),
        start_date: tournamentDateInputToIso(startDate),
        end_date: tournamentDateInputToIso(endDate),
        handicap_use_index: handicapUseIndex,
        handicap_allowance_pct: handicapAllowancePct,
        match_use_net_scoring: matchUseNetScoring,
        ...buildSchedulePayload(schedule),
      };

      if (creating) {
        const result = await createTournament(payload);
        if (result.error || !result.data) {
          throw new Error(result.error ?? 'Could not create tournament');
        }
        return result.data;
      }

      if (!selectedTournamentId) {
        throw new Error('No tournament selected');
      }

      const updated = await updateTournament(selectedTournamentId, payload);
      if (!updated) {
        throw new Error('Could not save tournament');
      }
      return updated;
    },
    onSuccess: (tournament: Tournament, creating) => {
      setIsCreating(false);
      setSelectedTournamentId(tournament.id);
      invalidateTournamentQueries(tournament.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', creating ? 'Tournament created.' : 'Tournament updated.');
    },
    onError: (error: Error) => {
      Alert.alert('Save failed', error.message);
    },
  });

  const deleteTournamentMutation = useMutation({
    mutationFn: async (id: string) => {
      const ok = await deleteTournament(id);
      if (!ok) throw new Error('Could not delete tournament');
      return id;
    },
    onSuccess: (deletedId) => {
      invalidateTournamentQueries();
      if (selectedTournamentId === deletedId) {
        setSelectedTournamentId(null);
        setIsCreating(false);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert('Delete failed', error.message);
    },
  });

  const confirmDeleteTournament = (tournament: Tournament) => {
    Alert.alert(
      'Delete tournament?',
      `"${tournament.name}" and all teams, matches, and scores will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTournamentMutation.mutate(tournament.id),
        },
      ]
    );
  };

  const startCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCreating(true);
    setSelectedTournamentId(null);
    setName('');
    setStartDate('');
    setEndDate('');
    setSchedule(createEmptySchedule());
    setHandicapUseIndex(true);
    setHandicapAllowancePct(100);
    setMatchUseNetScoring(false);
    setTab('event');
  };

  const selectTournament = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCreating(false);
    setSelectedTournamentId(id);
  };

  const isLoading = tournamentsLoading || (Boolean(tournamentId) && tournamentLoading && !selectedTournament);
  const isTeamsInitialLoading = teamsLoading && teams.length === 0;
  const activeTournament = isCreating ? null : selectedTournament;

  const tabs: { key: ManagementTab; label: string; Icon: typeof Trophy }[] = [
    { key: 'event', label: 'Event', Icon: Trophy },
    { key: 'participants', label: 'Participants', Icon: UserRound },
    { key: 'teams', label: 'Teams', Icon: Users },
    { key: 'matches', label: 'Matches', Icon: Swords },
    { key: 'standings', label: 'Live Standings', Icon: Medal },
    { key: 'publish', label: 'Send Invites', Icon: Mail },
    { key: 'formats', label: 'Formats', Icon: BookOpen },
  ];

  return (
    <View className="flex-1">
      <View className="flex-row items-center mb-4">
        <Pressable onPress={onBack} className="mr-3 p-1 active:opacity-70">
          <ArrowLeft size={22} color="#a3e635" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-white text-xl font-bold">Tournaments & Matches</Text>
          <Text className="text-neutral-500 text-sm">Edit events, teams, formats & matchups</Text>
        </View>
        <Pressable
          onPress={startCreate}
          className="flex-row items-center bg-lime-600 rounded-full px-3 py-1.5 active:opacity-80"
        >
          <Plus size={14} color="#fff" />
          <Text className="text-white text-xs font-semibold ml-1">New</Text>
        </Pressable>
      </View>

      {tournamentsError ? (
        <TournamentDataLoadError
          title="Could not load events"
          message={
            tournamentsLoadError instanceof Error
              ? tournamentsLoadError.message
              : 'Try logging out of admin and signing in again.'
          }
          onRetry={() => void refetchTournaments()}
          className="mb-4"
        />
      ) : null}

      <View className="flex-row flex-wrap mb-4">
        {tournaments.map((tournament) => (
          <Pressable
            key={tournament.id}
            onPress={() => selectTournament(tournament.id)}
            className={cn(
              'px-4 py-2.5 rounded-xl border min-w-[120px] mr-2 mb-2',
              !isCreating && selectedTournamentId === tournament.id
                ? 'bg-lime-900/40 border-lime-600'
                : 'bg-[#141414] border-neutral-800'
            )}
          >
            <Text
              className={cn(
                'text-sm font-semibold',
                !isCreating && selectedTournamentId === tournament.id
                  ? 'text-lime-400'
                  : 'text-neutral-400'
              )}
              numberOfLines={1}
            >
              {tournament.name}
            </Text>
            <Text
              className={cn(
                'text-[10px] mt-0.5',
                !isCreating && selectedTournamentId === tournament.id
                  ? 'text-neutral-400'
                  : 'text-neutral-600'
              )}
            >
              {formatTournamentDates(tournament.start_date, tournament.end_date)}
            </Text>
          </Pressable>
        ))}
        {isCreating && (
          <View className="px-4 py-2.5 rounded-xl border bg-lime-900/40 border-lime-600 min-w-[120px] mr-2 mb-2">
            <Text className="text-lime-400 text-sm font-semibold">New Event</Text>
          </View>
        )}
      </View>

      <View className="flex-row flex-wrap mb-4">
        {tabs.map(({ key, label, Icon }) => (
          <Pressable
            key={key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTab(key);
            }}
            disabled={isCreating && key !== 'event' && key !== 'formats'}
            className={cn(
              'px-4 py-2 rounded-lg border flex-row items-center gap-1.5 mr-2 mb-2',
              tab === key ? 'bg-lime-600 border-lime-600' : 'bg-[#141414] border-neutral-800',
              isCreating && key !== 'event' && key !== 'formats' && 'opacity-40'
            )}
          >
            <Icon size={14} color={tab === key ? '#fff' : '#737373'} />
            <Text
              className={cn('text-xs font-medium', tab === key ? 'text-white' : 'text-neutral-500')}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'formats' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <AdminTournamentFormatsTab accessToken={accessToken} />
        </ScrollView>
      ) : tab === 'matches' ? (
        activeTournament ? (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            <TournamentMatchGroupsTab
              tournamentId={activeTournament.id}
              tournament={activeTournament}
              teams={teams}
              members={members}
              playerNameById={playerNameById}
              isManager
              scorecardReturnTo="admin"
            />
          </ScrollView>
        ) : (
          <Text className="text-neutral-500 text-sm text-center px-4 py-8">
            Select or create a tournament first.
          </Text>
        )
      ) : tab === 'standings' ? (
        activeTournament ? (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            <TournamentLiveStandingsPanel
              tournamentId={activeTournament.id}
              displayToken={activeTournament.display_token}
              showTvLink
            />
          </ScrollView>
        ) : (
          <Text className="text-neutral-500 text-sm text-center px-4 py-8">
            Select or create a tournament first.
          </Text>
        )
      ) : (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {isLoading && !isCreating ? (
          <View className="py-12 items-center">
            <ActivityIndicator color="#a3e635" />
          </View>
        ) : tab === 'event' ? (
          isCreating || activeTournament ? (
            <Animated.View entering={FadeInDown.duration(400)}>
              {!isCreating && activeTournament && (
                <View className="mb-4">
                  <TournamentTeamMatchupBoard
                    teams={teams}
                    teamStats={teamStats}
                    subtitle="Current matchup"
                    compact
                  />
                </View>
              )}

              <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                {isCreating ? 'New Tournament' : 'Edit Tournament'}
              </Text>

              <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2 mt-2">
                Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Member-Guest 2026"
                placeholderTextColor="#525252"
                className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-3 text-white mb-4"
              />

              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                    Start
                  </Text>
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#525252"
                    className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-3 text-white"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">End</Text>
                  <TextInput
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#525252"
                    className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-3 text-white"
                  />
                </View>
              </View>
              <Text className="text-neutral-600 text-xs mb-4">
                Dates and tee times use Moncton time (ADT / AST).
              </Text>

              <TournamentScheduleEditor
                schedule={schedule}
                onScheduleChange={setSchedule}
                presetFormatIds={activeFormatIds}
                customFormatByKey={customFormatByKey}
                onCustomFormatChange={(key, value) =>
                  setCustomFormatByKey((prev) => ({ ...prev, [key]: value }))
                }
              />

              <View className="bg-[#141414] border border-neutral-800 rounded-xl p-4 mt-4 mb-2">
                <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">
                  Handicaps
                </Text>
                <TournamentHandicapFields
                  useIndex={handicapUseIndex}
                  onUseIndexChange={setHandicapUseIndex}
                  allowancePct={handicapAllowancePct}
                  onAllowancePctChange={setHandicapAllowancePct}
                  inheritLabel="Default for all players unless overridden on the roster."
                />

                <View className="mt-4 pt-4 border-t border-neutral-800">
                  <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                    Match play scoring
                  </Text>
                  <Text className="text-neutral-600 text-xs mb-3">
                    Default is gross best-ball. Enable net when handicaps should decide holes.
                  </Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => setMatchUseNetScoring(false)}
                      className={cn(
                        'flex-1 rounded-xl py-2.5 items-center border',
                        !matchUseNetScoring
                          ? 'bg-lime-900/30 border-lime-600'
                          : 'bg-[#0c0c0c] border-neutral-800'
                      )}
                    >
                      <Text
                        className={
                          !matchUseNetScoring
                            ? 'text-lime-400 font-semibold text-sm'
                            : 'text-neutral-400 text-sm'
                        }
                      >
                        Gross
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setMatchUseNetScoring(true)}
                      className={cn(
                        'flex-1 rounded-xl py-2.5 items-center border',
                        matchUseNetScoring
                          ? 'bg-lime-900/30 border-lime-600'
                          : 'bg-[#0c0c0c] border-neutral-800'
                      )}
                    >
                      <Text
                        className={
                          matchUseNetScoring
                            ? 'text-lime-400 font-semibold text-sm'
                            : 'text-neutral-400 text-sm'
                        }
                      >
                        Net (hcp)
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => saveTournamentMutation.mutate(isCreating)}
                disabled={saveTournamentMutation.isPending || !name.trim() || !startDate || !endDate}
                className="flex-row items-center justify-center bg-lime-600 rounded-xl py-4 mt-4 active:opacity-80"
              >
                {saveTournamentMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Save size={18} color="#fff" />
                    <Text className="text-white font-bold ml-2">
                      {isCreating ? 'Create Tournament' : 'Save Changes'}
                    </Text>
                  </>
                )}
              </Pressable>

              {!isCreating && activeTournament && (
                <Pressable
                  onPress={() => confirmDeleteTournament(activeTournament)}
                  disabled={deleteTournamentMutation.isPending}
                  className="flex-row items-center justify-center border border-red-800/60 bg-red-900/20 rounded-xl py-3.5 mt-3 active:opacity-80"
                >
                  <Trash2 size={16} color="#f87171" />
                  <Text className="text-red-400 font-semibold ml-2">Delete Tournament</Text>
                </Pressable>
              )}

              {isCreating && (
                <Pressable
                  onPress={() => {
                    setIsCreating(false);
                    if (tournaments[0]) setSelectedTournamentId(tournaments[0].id);
                  }}
                  className="items-center py-3 mt-2 active:opacity-70"
                >
                  <Text className="text-neutral-500 text-sm">Cancel</Text>
                </Pressable>
              )}
            </Animated.View>
          ) : (
            <Text className="text-neutral-500 text-sm text-center px-4">
              No tournaments yet. Tap New to create one.
            </Text>
          )
        ) : tab === 'participants' ? (
          !activeTournament ? (
            <Text className="text-neutral-500 text-sm text-center px-4">
              Select or create a tournament first.
            </Text>
          ) : (
              <TournamentParticipantsTab
                tournamentId={activeTournament.id}
                tournament={activeTournament}
                participants={tournamentPlayers}
                teams={teams}
                members={members}
                accessToken={accessToken}
              />
          )
        ) : tab === 'teams' ? (
          !activeTournament ? (
            <Text className="text-neutral-500 text-sm text-center px-4">
              Select or create a tournament first.
            </Text>
          ) : isTeamsInitialLoading ? (
            <View className="py-12 items-center">
              <ActivityIndicator color="#a3e635" />
            </View>
          ) : (
            <View>
              <Text className="text-white font-semibold text-lg mb-1">{activeTournament.name}</Text>
              <Text className="text-neutral-500 text-sm mb-4">
                {formatTournamentDates(activeTournament.start_date, activeTournament.end_date)}
              </Text>

              <TournamentTeamMatchupBoard
                teams={teams}
                teamStats={teamStats}
                subtitle="Team matchup preview"
              />

              <TournamentTeamsAssignTab
                tournamentId={activeTournament.id}
                tournament={activeTournament}
                teams={teams}
                participants={tournamentPlayers}
                members={members}
                accessToken={accessToken}
              />

              {teams.length > 0 ? (
                <>
                  <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mt-5 mb-3">
                    Team Logos
                  </Text>
                  {teams.map((team) => (
                    <View
                      key={`logo-${team.id}`}
                      className="bg-[#141414] rounded-2xl border border-neutral-800 p-4 mb-3"
                    >
                      <Text className="text-white font-semibold">{team.team_name}</Text>
                      <TeamLogoUploadCard
                        team={team}
                        accessToken={accessToken}
                        uploading={uploadingTeamId === team.id}
                        onUploadStart={setUploadingTeamId}
                        onUploaded={() => invalidateTournamentQueries(tournamentId)}
                      />
                    </View>
                  ))}
                </>
              ) : null}

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTab('matches');
                }}
                className="mt-2 flex-row items-center justify-center border border-neutral-700 rounded-xl py-3 active:opacity-80"
              >
                <Swords size={16} color="#a3e635" />
                <Text className="text-lime-400 font-semibold ml-2">Continue to Pairings Board</Text>
              </Pressable>
            </View>
          )
        ) : tab === 'publish' ? (
          !activeTournament ? (
            <Text className="text-neutral-500 text-sm text-center px-4">
              Select or create a tournament first.
            </Text>
          ) : (
            <TournamentPublishTab
              tournamentId={activeTournament.id}
              tournament={activeTournament}
              participants={tournamentPlayers}
              teams={teams}
              members={members}
              accessToken={accessToken}
            />
          )
        ) : null}
      </ScrollView>
      )}
    </View>
  );
}
