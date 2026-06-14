import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { ClipboardList, Plus, Save, Trash2, X, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import {
  countMatchHoleWins,
  deleteTournamentMatchGroup,
  getMatchHoleResultsForGroups,
  getTeamBySide,
  getTournamentMatchGroups,
  saveTournamentMatchGroup,
} from '@/lib/tournament-match-service';
import { formatTeeAssignmentTime } from '@/lib/tournament-tee-service';
import {
  FORMAT_LABELS,
  FORMAT_MATCH_SCORING_HINTS,
  MATCH_FORMATS,
  getMatchGroupFormat,
  getRoundFormat,
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

  const sideATeam = getTeamBySide(teams, 'side_a');
  const sideBTeam = getTeamBySide(teams, 'side_b');
  const playersPerMatch = tournament.players_per_match ?? 2;
  const roundFormat = getRoundFormat(tournament, roundNumber);

  useEffect(() => {
    setMatchFormat(roundFormat);
  }, [roundNumber, roundFormat]);

  const memberNameById = useMemo(
    () => ({ ...playerNameById, ...Object.fromEntries(members.map((m) => [m.id, m.full_name])) }),
    [members, playerNameById]
  );

  const { data: matchGroups = [], isLoading } = useQuery({
    queryKey: ['tournamentMatchGroups', tournamentId, roundNumber],
    queryFn: () => getTournamentMatchGroups(tournamentId, roundNumber),
  });

  const matchGroupIds = useMemo(() => matchGroups.map((g) => g.id), [matchGroups]);

  const { data: holeResults = [] } = useQuery({
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
    router.push(`/tournament/scorecard?${params.toString()}`);
  };

  const saveMutation = useMutation({
    mutationFn: saveTournamentMatchGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentMatchGroups', tournamentId] });
      setShowCreate(false);
      setSelectedSideA([]);
      setSelectedSideB([]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTournamentMatchGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentMatchGroups', tournamentId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const togglePlayer = (side: 'a' | 'b', playerId: string) => {
    const roster = side === 'a' ? sideATeam?.player_ids ?? [] : sideBTeam?.player_ids ?? [];
    if (!roster.includes(playerId)) return;

    const setter = side === 'a' ? setSelectedSideA : setSelectedSideB;
    setter((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId);
      if (prev.length >= playersPerMatch) return prev;
      return [...prev, playerId];
    });
  };

  const handleCreate = () => {
    if (!sideATeam || !sideBTeam) return;
    if (selectedSideA.length !== playersPerMatch || selectedSideB.length !== playersPerMatch) {
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
      tee_time: buildTeeTimeIso(tournament.start_date, roundNumber, teeTime),
      starting_hole: Math.min(18, Math.max(1, Number(startingHole) || 1)),
      group_number: matchGroups.length + 1,
    });
  };

  if (isLoading) {
    return (
      <View className="py-16 items-center">
        <ActivityIndicator color="#a3e635" />
      </View>
    );
  }

  if (!sideATeam || !sideBTeam) {
    return (
      <View className="mx-5 mt-4 py-10 items-center bg-[#141414] rounded-2xl border border-neutral-800">
        <Users size={32} color="#525252" />
        <Text className="text-neutral-300 font-medium mt-3 text-center px-6">
          Create Team A and Team B on the Teams tab before setting up 2v2 matches.
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
        <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-1">
          Round format
        </Text>
        <Text className="text-lime-400 font-semibold">{FORMAT_LABELS[roundFormat]}</Text>
        <Text className="text-neutral-400 text-sm mt-1">
          {playersPerMatch}v{playersPerMatch} matches · {FORMAT_MATCH_SCORING_HINTS[roundFormat]}
        </Text>
      </View>

      {matchGroups.length === 0 ? (
        <View className="py-10 items-center bg-[#141414] rounded-2xl border border-neutral-800 mb-4">
          <Text className="text-neutral-400">No matches scheduled for this round</Text>
        </View>
      ) : (
        matchGroups.map((group) => {
          const groupFormat = getMatchGroupFormat(group, tournament);
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
                {FORMAT_LABELS[groupFormat]}
              </Text>
              <Text className="text-neutral-400 text-xs mt-0.5">
                {FORMAT_MATCH_SCORING_HINTS[groupFormat]}
              </Text>
            </View>
            <Text className="text-white text-sm">
              {sideLabel('side_a')}:{' '}
              {group.side_a_player_ids.map((id) => memberNameById[id]?.split(' ')[0] ?? '?').join(' & ')}
            </Text>
            <Text className="text-neutral-500 text-xs my-1">vs</Text>
            <Text className="text-white text-sm">
              {sideLabel('side_b')}:{' '}
              {group.side_b_player_ids.map((id) => memberNameById[id]?.split(' ')[0] ?? '?').join(' & ')}
            </Text>

            {(() => {
              const wins = holeWinsByGroupId[group.id];
              if (!wins || wins.side_a + wins.side_b + wins.ties === 0) return null;
              return (
                <View className="mt-3 pt-3 border-t border-neutral-800">
                  <Text className="text-neutral-400 text-xs uppercase tracking-widest mb-1">
                    Match status
                  </Text>
                  <Text className="text-white font-semibold">
                    {sideLabel('side_a')} {wins.side_a} – {wins.side_b} {sideLabel('side_b')}
                    {wins.ties > 0 ? ` · ${wins.ties} tied` : ''}
                  </Text>
                </View>
              );
            })()}

            <View className="flex-row gap-2 mt-3">
              {groupFormat === 'singles' ? (
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
          <Text className="text-lime-400 font-semibold ml-2">Add 2v2 Match</Text>
        </Pressable>
      )}

      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#141414] rounded-t-3xl border-t border-neutral-800 px-5 pt-5 pb-10 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-lg font-bold">New 2v2 Match</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <X size={22} color="#737373" />
              </Pressable>
            </View>

            <ScrollView>
              <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                Match Format
              </Text>
              <Text className="text-neutral-600 text-xs mb-2">
                Defaults from Round {roundNumber} schedule. Override if this pairing uses a different
                format.
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
                      {FORMAT_LABELS[format]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text className="text-neutral-400 text-xs mb-4">
                {FORMAT_MATCH_SCORING_HINTS[matchFormat]}
              </Text>

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

              <Text className="text-lime-400 text-xs uppercase tracking-widest mb-2">
                Team A ({selectedSideA.length}/{playersPerMatch})
              </Text>
              {sideATeam.player_ids.map((pid) => (
                <Pressable
                  key={pid}
                  onPress={() => togglePlayer('a', pid)}
                  className={cn(
                    'px-4 py-3 rounded-xl mb-2 border',
                    selectedSideA.includes(pid)
                      ? 'bg-lime-900/30 border-lime-600'
                      : 'bg-[#0c0c0c] border-neutral-800'
                  )}
                >
                  <Text className="text-white">{memberNameById[pid] ?? pid.slice(0, 8)}</Text>
                </Pressable>
              ))}

              <Text className="text-lime-400 text-xs uppercase tracking-widest mb-2 mt-4">
                Team B ({selectedSideB.length}/{playersPerMatch})
              </Text>
              {sideBTeam.player_ids.map((pid) => (
                <Pressable
                  key={pid}
                  onPress={() => togglePlayer('b', pid)}
                  className={cn(
                    'px-4 py-3 rounded-xl mb-2 border',
                    selectedSideB.includes(pid)
                      ? 'bg-lime-900/30 border-lime-600'
                      : 'bg-[#0c0c0c] border-neutral-800'
                  )}
                >
                  <Text className="text-white">{memberNameById[pid] ?? pid.slice(0, 8)}</Text>
                </Pressable>
              ))}
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
