import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { ClipboardList, Plus, Save, Trash2, X, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import {
  countMatchHoleWins,
  deleteTournamentMatchGroup,
  getAssignedPlayerIdsForRound,
  getMatchHoleResultsForGroups,
  getTeamBySide,
  getTournamentMatchGroups,
  saveTournamentMatchGroup,
} from '@/lib/tournament-match-service';
import { appendPlayersToTeam, getTournamentPlayers } from '@/lib/tournament-player-service';
import { formatTeeAssignmentTime } from '@/lib/tournament-tee-service';
import { getDayNumberForRound } from '@/lib/tournament-schedule';
import {
  formatLabel,
  formatScoringHint,
  getMatchGroupFormat,
  getRoundFormat,
  isSinglesFormat,
  MATCH_FORMATS,
} from '@/lib/tournament-labels';
import type { Tournament, TournamentFormat, TournamentTeam, TournamentTeamSide } from '@/types';
import { cn } from '@/lib/cn';

interface MemberOption {
  id: string;
  full_name: string;
}

interface TournamentMatchGroupsTabProps {
  tournamentId: string;
  tournament: Tournament;
  teams: TournamentTeam[];
  members: MemberOption[];
  playerNameById: Record<string, string>;
  isManager: boolean;
}

function buildTeeTimeIso(tournamentStartDate: string, dayNumber: number, timeHm: string): string {
  const base = new Date(tournamentStartDate);
  base.setDate(base.getDate() + (dayNumber - 1));
  const parts = timeHm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!parts) {
    base.setHours(8, 0, 0, 0);
    return base.toISOString();
  }
  base.setHours(Number(parts[1]), Number(parts[2]), 0, 0);
  return base.toISOString();
}

function sideLabel(side: TournamentTeamSide): string {
  return side === 'side_a' ? 'Team A' : 'Team B';
}

function SlotBadge({
  label,
  filled,
  onPress,
}: {
  label: string;
  filled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'px-3 py-2 rounded-full border min-w-[88px] items-center',
        filled ? 'bg-lime-900/40 border-lime-600' : 'bg-[#0c0c0c] border-dashed border-neutral-700'
      )}
    >
      <Text className={cn('text-xs font-semibold', filled ? 'text-lime-300' : 'text-neutral-600')}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TournamentMatchGroupsTab({
  tournamentId,
  tournament,
  teams,
  members,
  playerNameById,
  isManager,
}: TournamentMatchGroupsTabProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [roundNumber, setRoundNumber] = useState(1);
  const [matchFormat, setMatchFormat] = useState<TournamentFormat>('scramble');
  const [showCreate, setShowCreate] = useState(false);
  const [teeTime, setTeeTime] = useState('08:00');
  const [startingHole, setStartingHole] = useState('1');
  const [selectedSideA, setSelectedSideA] = useState<string[]>([]);
  const [selectedSideB, setSelectedSideB] = useState<string[]>([]);
  const [activeSide, setActiveSide] = useState<'a' | 'b'>('a');
  const [guestName, setGuestName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const sideATeam = getTeamBySide(teams, 'side_a');
  const sideBTeam = getTeamBySide(teams, 'side_b');
  const playersPerMatch = tournament.players_per_match ?? 2;
  const roundFormat = getRoundFormat(tournament, roundNumber);
  const dayNumber = getDayNumberForRound(tournament.round_schedule, roundNumber);

  useEffect(() => {
    setMatchFormat(roundFormat);
  }, [roundNumber, roundFormat]);

  const { data: tournamentPlayers = [] } = useQuery({
    queryKey: ['tournamentPlayers', tournamentId],
    queryFn: () => getTournamentPlayers(tournamentId),
  });

  const memberNameById = useMemo(
    () => ({ ...playerNameById, ...Object.fromEntries(members.map((m) => [m.id, m.full_name])) }),
    [members, playerNameById]
  );

  const { data: allMatchGroups = [] } = useQuery({
    queryKey: ['tournamentMatchGroups', tournamentId],
    queryFn: () => getTournamentMatchGroups(tournamentId),
  });

  const matchGroups = useMemo(
    () => allMatchGroups.filter((g) => g.round_number === roundNumber),
    [allMatchGroups, roundNumber]
  );

  const assignedPlayerIds = useMemo(
    () => getAssignedPlayerIdsForRound(allMatchGroups, roundNumber),
    [allMatchGroups, roundNumber]
  );

  const rosterPool = useMemo(() => {
    const ids = new Set<string>();
    sideATeam?.player_ids.forEach((id) => ids.add(id));
    sideBTeam?.player_ids.forEach((id) => ids.add(id));
    return Array.from(ids).map((id) => ({
      id,
      name: memberNameById[id] ?? 'Player',
      assigned: assignedPlayerIds.has(id),
      inSlots: selectedSideA.includes(id) || selectedSideB.includes(id),
    }));
  }, [
    sideATeam,
    sideBTeam,
    memberNameById,
    assignedPlayerIds,
    selectedSideA,
    selectedSideB,
  ]);

  const matchGroupIds = useMemo(() => matchGroups.map((g) => g.id), [matchGroups]);

  const { data: holeResults = [], isLoading } = useQuery({
    queryKey: ['matchHoleResults', tournamentId, roundNumber, matchGroupIds.join(',')],
    queryFn: () => getMatchHoleResultsForGroups(matchGroupIds, roundNumber),
    enabled: matchGroupIds.length > 0,
  });

  const holeWinsByGroupId = useMemo(() => {
    const map: Record<string, ReturnType<typeof countMatchHoleWins>> = {};
    for (const group of matchGroups) {
      const groupResults = holeResults.filter((r) => r.match_group_id === group.id);
      map[group.id] = countMatchHoleWins(groupResults);
    }
    return map;
  }, [matchGroups, holeResults]);

  const openScorecard = (groupId: string, side?: 'side_a' | 'side_b') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const params = new URLSearchParams({
      id: tournamentId,
      matchGroupId: groupId,
      round: String(roundNumber),
    });
    if (side) params.set('side', side);
    router.push(`/(tabs)/scorecard?${params.toString()}`);
  };

  const saveMutation = useMutation({
    mutationFn: saveTournamentMatchGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentMatchGroups', tournamentId] });
      setShowCreate(false);
      setSelectedSideA([]);
      setSelectedSideB([]);
      setGuestName('');
      setSaveError(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      setSaveError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTournamentMatchGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentMatchGroups', tournamentId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const assignPlayerToSide = (side: 'a' | 'b', playerId: string) => {
    const roster = side === 'a' ? sideATeam?.player_ids ?? [] : sideBTeam?.player_ids ?? [];
    if (!roster.includes(playerId)) return;

    const selected = side === 'a' ? selectedSideA : selectedSideB;
    const setter = side === 'a' ? setSelectedSideA : setSelectedSideB;

    if (selected.includes(playerId)) {
      setter(selected.filter((id) => id !== playerId));
      return;
    }

    if (selected.length >= playersPerMatch) {
      Alert.alert('Slots full', `Remove a player from ${sideLabel(side === 'a' ? 'side_a' : 'side_b')} first.`);
      return;
    }

    if (assignedPlayerIds.has(playerId)) {
      Alert.alert('Already assigned', 'This player is already in another foursome this round.');
      return;
    }

    const otherSide = side === 'a' ? selectedSideB : selectedSideA;
    if (otherSide.includes(playerId)) {
      Alert.alert('Wrong side', 'Player is already on the other side for this match.');
      return;
    }

    setter([...selected, playerId]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeFromSlot = (side: 'a' | 'b', index: number) => {
    const setter = side === 'a' ? setSelectedSideA : setSelectedSideB;
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const addGuestPlayer = async () => {
    const name = guestName.trim();
    if (!name) return;

    const rosterSide = activeSide === 'a' ? sideATeam : sideBTeam;
    if (!rosterSide) return;

    const teamResult = await appendPlayersToTeam(rosterSide, [
      {
        display_name: name,
        handicap_index: 0,
      },
    ]);

    if (teamResult.error || !teamResult.data) {
      Alert.alert('Could not add guest', teamResult.error ?? 'Unknown error');
      return;
    }

    const newPlayerId = teamResult.data.player_ids[teamResult.data.player_ids.length - 1];
    queryClient.invalidateQueries({ queryKey: ['tournamentPlayers', tournamentId] });
    queryClient.invalidateQueries({ queryKey: ['tournamentTeams', tournamentId] });
    setGuestName('');
    if (newPlayerId) {
      assignPlayerToSide(activeSide, newPlayerId);
    }
  };

  const handleCreate = () => {
    if (!sideATeam || !sideBTeam) return;
    setSaveError(null);

    if (selectedSideA.length !== playersPerMatch || selectedSideB.length !== playersPerMatch) {
      setSaveError(`Select ${playersPerMatch} players per side.`);
      return;
    }

    const conflict = [...selectedSideA, ...selectedSideB].find((id) => assignedPlayerIds.has(id));
    if (conflict) {
      setSaveError('A selected player is already assigned to another match this round.');
      return;
    }

    saveMutation.mutate({
      tournament_id: tournamentId,
      round_number: roundNumber,
      format: matchFormat,
      side_a_team_id: sideATeam.id,
      side_b_team_id: sideBTeam.id,
      side_a_player_ids: selectedSideA,
      side_b_player_ids: selectedSideB,
      tee_time: buildTeeTimeIso(tournament.start_date, dayNumber, teeTime),
      starting_hole: Math.min(18, Math.max(1, Number(startingHole) || 1)),
      group_number: matchGroups.length + 1,
    });
  };

  if (!sideATeam || !sideBTeam) {
    return (
      <View className="mx-5 mt-4 py-10 items-center bg-[#141414] rounded-2xl border border-neutral-800">
        <Users size={32} color="#525252" />
        <Text className="text-neutral-300 font-medium mt-3 text-center px-6">
          Create Team A and Team B on the Teams tab before setting up foursome matches.
        </Text>
      </View>
    );
  }

  return (
    <View className="mx-5 mt-2">
      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">Round</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        <View className="flex-row gap-2">
          {Array.from({ length: tournament.rounds_count }, (_, i) => i + 1).map((n) => (
            <Pressable
              key={n}
              onPress={() => setRoundNumber(n)}
              className={cn(
                'px-4 py-2 rounded-lg border',
                roundNumber === n
                  ? 'bg-lime-900/40 border-lime-600'
                  : 'bg-[#141414] border-neutral-800'
              )}
            >
              <Text className={roundNumber === n ? 'text-lime-400 font-semibold' : 'text-neutral-500'}>
                Round {n}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-4">
        <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-1">Round format</Text>
        <Text className="text-lime-400 font-semibold">{formatLabel(roundFormat)}</Text>
        <Text className="text-neutral-400 text-sm mt-1">
          {playersPerMatch}v{playersPerMatch} foursomes · {formatScoringHint(roundFormat)}
        </Text>
      </View>

      {isLoading && matchGroups.length > 0 ? (
        <View className="py-8 items-center">
          <ActivityIndicator color="#a3e635" />
        </View>
      ) : null}

      {matchGroups.length === 0 ? (
        <View className="py-10 items-center bg-[#141414] rounded-2xl border border-neutral-800 mb-4">
          <Text className="text-neutral-400">No matches scheduled for this round</Text>
        </View>
      ) : (
        matchGroups.map((group) => {
          const groupFormat = getMatchGroupFormat(group, tournament);
          const wins = holeWinsByGroupId[group.id];
          return (
            <View
              key={group.id}
              className="bg-[#141414] border border-neutral-800 rounded-xl p-4 mb-3"
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-lime-400 font-bold">
                  {formatTeeAssignmentTime(group.tee_time)} · Hole {group.starting_hole}
                </Text>
                {isManager && (
                  <Pressable onPress={() => deleteMutation.mutate(group.id)} className="p-1">
                    <Trash2 size={16} color="#737373" />
                  </Pressable>
                )}
              </View>
              <View className="bg-lime-900/20 border border-lime-700/30 rounded-lg px-3 py-2 mb-2">
                <Text className="text-lime-400 text-xs font-bold uppercase">
                  {formatLabel(groupFormat)}
                </Text>
                {(group.match_points_a > 0 || group.match_points_b > 0) && (
                  <Text className="text-white text-sm font-semibold mt-1">
                    Match points: {sideLabel('side_a')} {group.match_points_a} – {group.match_points_b}{' '}
                    {sideLabel('side_b')}
                  </Text>
                )}
              </View>
              <Text className="text-white text-sm">
                {sideLabel('side_a')}:{' '}
                {group.side_a_player_ids
                  .map((id) => memberNameById[id]?.split(' ')[0] ?? '?')
                  .join(' & ')}
              </Text>
              <Text className="text-neutral-500 text-xs my-1">vs</Text>
              <Text className="text-white text-sm">
                {sideLabel('side_b')}:{' '}
                {group.side_b_player_ids
                  .map((id) => memberNameById[id]?.split(' ')[0] ?? '?')
                  .join(' & ')}
              </Text>

              {wins && wins.side_a + wins.side_b + wins.ties > 0 && (
                <View className="mt-3 pt-3 border-t border-neutral-800">
                  <Text className="text-neutral-400 text-xs uppercase tracking-widest mb-1">
                    Holes won
                  </Text>
                  <Text className="text-white font-semibold">
                    {sideLabel('side_a')} {wins.side_a} – {wins.side_b} {sideLabel('side_b')}
                  </Text>
                </View>
              )}

              <View className="flex-row gap-2 mt-3">
                {isSinglesFormat(groupFormat) ? (
                  <Pressable
                    onPress={() => openScorecard(group.id)}
                    className="flex-1 flex-row items-center justify-center bg-lime-600 rounded-lg py-2.5 active:opacity-80"
                  >
                    <ClipboardList size={14} color="#fff" />
                    <Text className="text-white font-semibold text-xs ml-1.5">Enter Scores</Text>
                  </Pressable>
                ) : (
                  (['side_a', 'side_b'] as const).map((matchSide) => (
                    <Pressable
                      key={matchSide}
                      onPress={() => openScorecard(group.id, matchSide)}
                      className="flex-1 flex-row items-center justify-center bg-lime-900/40 border border-lime-700/50 rounded-lg py-2.5 active:opacity-80"
                    >
                      <ClipboardList size={14} color="#a3e635" />
                      <Text className="text-lime-400 font-semibold text-xs ml-1.5">
                        {sideLabel(matchSide)}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            </View>
          );
        })
      )}

      {isManager && (
        <Pressable
          onPress={() => setShowCreate(true)}
          className="flex-row items-center justify-center border border-dashed border-neutral-700 rounded-xl py-3 active:opacity-80"
        >
          <Plus size={16} color="#a3e635" />
          <Text className="text-lime-400 font-semibold ml-2">Add Foursome Match</Text>
        </Pressable>
      )}

      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#141414] rounded-t-3xl border-t border-neutral-800 px-5 pt-5 pb-10 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-lg font-bold">New Foursome</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <X size={22} color="#737373" />
              </Pressable>
            </View>

            <ScrollView>
              <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                Match Format
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {MATCH_FORMATS.map((format) => (
                  <Pressable
                    key={format}
                    onPress={() => setMatchFormat(format)}
                    className={cn(
                      'px-3 py-2 rounded-lg border',
                      matchFormat === format
                        ? 'bg-lime-900/40 border-lime-600'
                        : 'bg-[#0c0c0c] border-neutral-800'
                    )}
                  >
                    <Text
                      className={cn(
                        'text-xs font-medium',
                        matchFormat === format ? 'text-lime-400' : 'text-neutral-500'
                      )}
                    >
                      {formatLabel(format)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View className="flex-row gap-2 mb-4">
                <View className="flex-1">
                  <Text className="text-neutral-500 text-xs mb-1">Tee Time</Text>
                  <TextInput
                    value={teeTime}
                    onChangeText={setTeeTime}
                    placeholder="08:30"
                    placeholderTextColor="#525252"
                    className="bg-[#0c0c0c] border border-neutral-800 rounded-lg px-3 py-2 text-white"
                  />
                </View>
                <View className="w-20">
                  <Text className="text-neutral-500 text-xs mb-1">Hole</Text>
                  <TextInput
                    value={startingHole}
                    onChangeText={setStartingHole}
                    keyboardType="number-pad"
                    className="bg-[#0c0c0c] border border-neutral-800 rounded-lg px-3 py-2 text-white text-center"
                  />
                </View>
              </View>

              <View className="flex-row gap-2 mb-3">
                {(['a', 'b'] as const).map((side) => (
                  <Pressable
                    key={side}
                    onPress={() => setActiveSide(side)}
                    className={cn(
                      'flex-1 py-2 rounded-lg border items-center',
                      activeSide === side
                        ? 'bg-lime-900/40 border-lime-600'
                        : 'bg-[#0c0c0c] border-neutral-800'
                    )}
                  >
                    <Text
                      className={cn(
                        'text-xs font-bold',
                        activeSide === side ? 'text-lime-400' : 'text-neutral-500'
                      )}
                    >
                      Fill {sideLabel(side === 'a' ? 'side_a' : 'side_b')}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="text-lime-400 text-xs uppercase tracking-widest mb-2">
                {sideLabel('side_a')} slots
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {Array.from({ length: playersPerMatch }, (_, index) => {
                  const playerId = selectedSideA[index];
                  return (
                    <SlotBadge
                      key={`a-${index}`}
                      label={playerId ? memberNameById[playerId]?.split(' ')[0] ?? 'Player' : `Slot ${index + 1}`}
                      filled={Boolean(playerId)}
                      onPress={() => playerId && removeFromSlot('a', index)}
                    />
                  );
                })}
              </View>

              <Text className="text-lime-400 text-xs uppercase tracking-widest mb-2">
                {sideLabel('side_b')} slots
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {Array.from({ length: playersPerMatch }, (_, index) => {
                  const playerId = selectedSideB[index];
                  return (
                    <SlotBadge
                      key={`b-${index}`}
                      label={playerId ? memberNameById[playerId]?.split(' ')[0] ?? 'Player' : `Slot ${index + 1}`}
                      filled={Boolean(playerId)}
                      onPress={() => playerId && removeFromSlot('b', index)}
                    />
                  );
                })}
              </View>

              <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                Roster — tap to assign to {sideLabel(activeSide === 'a' ? 'side_a' : 'side_b')}
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {rosterPool.map((player) => (
                  <Pressable
                    key={player.id}
                    onPress={() => assignPlayerToSide(activeSide, player.id)}
                    disabled={player.assigned && !player.inSlots}
                    className={cn(
                      'px-3 py-2 rounded-full border',
                      player.inSlots
                        ? 'bg-lime-900/50 border-lime-500'
                        : player.assigned
                          ? 'bg-neutral-900 border-neutral-700 opacity-50'
                          : 'bg-[#0c0c0c] border-neutral-700 active:opacity-80'
                    )}
                  >
                    <Text
                      className={cn(
                        'text-xs font-medium',
                        player.inSlots ? 'text-lime-300' : 'text-neutral-300'
                      )}
                    >
                      {player.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="text-neutral-500 text-xs mb-1">Add guest by name</Text>
              <View className="flex-row gap-2 mb-4">
                <TextInput
                  value={guestName}
                  onChangeText={setGuestName}
                  placeholder="Guest name"
                  placeholderTextColor="#525252"
                  className="flex-1 bg-[#0c0c0c] border border-neutral-800 rounded-lg px-3 py-2 text-white"
                />
                <Pressable
                  onPress={addGuestPlayer}
                  className="px-4 py-2 rounded-lg bg-lime-900/30 border border-lime-700/50 active:opacity-80"
                >
                  <Text className="text-lime-400 text-xs font-bold">Add</Text>
                </Pressable>
              </View>

              {saveError ? (
                <Text className="text-red-400 text-sm mb-3">{saveError}</Text>
              ) : null}
            </ScrollView>

            <Pressable
              onPress={handleCreate}
              disabled={
                saveMutation.isPending ||
                selectedSideA.length !== playersPerMatch ||
                selectedSideB.length !== playersPerMatch
              }
              className="mt-4 flex-row items-center justify-center bg-lime-600 rounded-xl py-3.5 active:opacity-80"
            >
              {saveMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Save size={16} color="#fff" />
                  <Text className="text-white font-bold ml-2">Save Match</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
