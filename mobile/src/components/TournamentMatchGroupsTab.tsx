import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { ClipboardList, Save, Trash2, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import {
  countMatchHoleWins,
  deleteTournamentMatchGroup,
  getMatchHoleResultsForGroups,
  getTeamBySide,
  getTournamentMatchGroups,
} from '@/lib/tournament-match-service';
import { appendPlayersToTeam, getTournamentPlayers } from '@/lib/tournament-player-service';
import { formatTeeAssignmentTime } from '@/lib/tournament-tee-service';
import { getDayNumberForRound } from '@/lib/tournament-schedule';
import { TournamentFormatRulesCard } from '@/components/TournamentFormatRulesCard';
import {
  formatLabelFromSettings,
  formatScoringHintFromSettings,
  resolveFormatDefinition,
} from '@/lib/tournament-format-settings';
import { useTournamentFormatsSettings } from '@/lib/useTournamentFormatsSettings';
import {
  formatRoundPickerLabel,
  getMatchGroupFormat,
  getRoundFormat,
  getTeamSideDisplayName,
  isSinglesFormat,
} from '@/lib/tournament-labels';
import {
  createEmptyPairingRow,
  formatPairingRowTeeLabel,
  getAssignedPlayerIdsInDraftRows,
  incrementTeeTimeHm,
  matchGroupsToPairingRows,
  savePairingRowsBatch,
  type PairingRowDraft,
} from '@/lib/tournament-pairings-board';
import type { Tournament, TournamentTeam, TournamentTeamSide } from '@/types';
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

type ActiveSlot = {
  rowKey: string;
  side: 'a' | 'b';
  slotIndex: number;
};

function PlayerBadge({
  label,
  assigned,
  active,
  onPress,
  disabled,
}: {
  label: string;
  assigned?: boolean;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'px-3 py-2 rounded-full border mb-2',
        active
          ? 'bg-lime-900/60 border-lime-400'
          : assigned
            ? 'bg-neutral-900 border-neutral-700 opacity-40'
            : 'bg-[#0c0c0c] border-neutral-700 active:opacity-80'
      )}
    >
      <Text
        className={cn(
          'text-xs font-medium',
          active ? 'text-lime-200' : assigned ? 'text-neutral-500' : 'text-neutral-200'
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SlotBadge({
  label,
  filled,
  active,
  onPress,
  disabled,
}: {
  label: string;
  filled: boolean;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'px-2.5 py-2 rounded-full border min-w-[72px] items-center mb-1',
        active
          ? 'bg-lime-900/60 border-lime-400'
          : filled
            ? 'bg-lime-900/40 border-lime-600'
            : 'bg-[#0c0c0c] border-dashed border-neutral-700'
      )}
    >
      <Text
        className={cn(
          'text-[11px] font-semibold text-center',
          active ? 'text-lime-200' : filled ? 'text-lime-300' : 'text-neutral-600'
        )}
      >
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
  const { data: formatSettings } = useTournamentFormatsSettings();
  const [roundNumber, setRoundNumber] = useState(1);
  const [draftRows, setDraftRows] = useState<PairingRowDraft[]>([]);
  const [activeSlot, setActiveSlot] = useState<ActiveSlot | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [guestSide, setGuestSide] = useState<'a' | 'b'>('a');
  const [guestName, setGuestName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const sideATeam = getTeamBySide(teams, 'side_a');
  const sideBTeam = getTeamBySide(teams, 'side_b');
  const sideAName = getTeamSideDisplayName('side_a', teams);
  const sideBName = getTeamSideDisplayName('side_b', teams);
  const roundFormat = getRoundFormat(tournament, roundNumber);
  const roundFormatDef = resolveFormatDefinition(roundFormat, formatSettings);
  const playersPerMatch =
    roundFormatDef?.default_players_per_match ?? tournament.players_per_match ?? 2;
  const dayNumber = getDayNumberForRound(tournament.round_schedule, roundNumber);

  const memberNameById = useMemo(
    () => ({ ...playerNameById, ...Object.fromEntries(members.map((m) => [m.id, m.full_name])) }),
    [members, playerNameById]
  );

  const { data: allMatchGroups = [] } = useQuery({
    queryKey: ['tournamentMatchGroups', tournamentId],
    queryFn: () => getTournamentMatchGroups(tournamentId),
  });

  const matchGroups = useMemo(
    () => allMatchGroups.filter((group) => group.round_number === roundNumber),
    [allMatchGroups, roundNumber]
  );

  useEffect(() => {
    setDraftRows(matchGroupsToPairingRows(matchGroups));
    setActiveSlot(null);
    setIsDirty(false);
    setSaveError(null);
  }, [roundNumber]);

  useEffect(() => {
    if (!isDirty) {
      setDraftRows(matchGroupsToPairingRows(matchGroups));
    }
  }, [matchGroups, isDirty]);

  const assignedInDraft = useMemo(
    () => getAssignedPlayerIdsInDraftRows(draftRows),
    [draftRows]
  );

  const savedGroupIds = useMemo(
    () => draftRows.map((row) => row.groupId).filter(Boolean) as string[],
    [draftRows]
  );

  const { data: holeResults = [], isLoading } = useQuery({
    queryKey: ['matchHoleResults', tournamentId, roundNumber, savedGroupIds.join(',')],
    queryFn: () => getMatchHoleResultsForGroups(savedGroupIds, roundNumber),
    enabled: savedGroupIds.length > 0,
  });

  const holeWinsByGroupId = useMemo(() => {
    const map: Record<string, ReturnType<typeof countMatchHoleWins>> = {};
    for (const groupId of savedGroupIds) {
      const groupResults = holeResults.filter((row) => row.match_group_id === groupId);
      map[groupId] = countMatchHoleWins(groupResults);
    }
    return map;
  }, [holeResults, savedGroupIds]);

  const savedGroupById = useMemo(
    () => Object.fromEntries(matchGroups.map((group) => [group.id, group])),
    [matchGroups]
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!sideATeam || !sideBTeam) {
        throw new Error('Both teams must exist before saving pairings.');
      }
      return savePairingRowsBatch({
        tournament,
        roundNumber,
        roundFormat,
        sideATeam,
        sideBTeam,
        rows: draftRows,
        dayNumber,
        playersPerMatch,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentMatchGroups', tournamentId] });
      setIsDirty(false);
      setSaveError(null);
      setActiveSlot(null);
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

  const openScorecard = (groupId: string, side?: TournamentTeamSide) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const params = new URLSearchParams({
      id: tournamentId,
      matchGroupId: groupId,
      round: String(roundNumber),
    });
    if (side) params.set('side', side);
    router.push(`/(tabs)/scorecard?${params.toString()}`);
  };

  const markDirty = () => setIsDirty(true);

  const updateRow = (rowKey: string, updater: (row: PairingRowDraft) => PairingRowDraft) => {
    markDirty();
    setDraftRows((prev) => prev.map((row) => (row.clientKey === rowKey ? updater(row) : row)));
  };

  const addRows = (count: number) => {
    markDirty();
    setDraftRows((prev) => {
      const next = [...prev];
      let nextGroupNumber =
        prev.length > 0 ? Math.max(...prev.map((row) => row.groupNumber)) + 1 : 1;
      let nextTime =
        prev.length > 0 ? incrementTeeTimeHm(prev[prev.length - 1].teeTime, 10) : '08:00';

      for (let i = 0; i < count; i += 1) {
        next.push(createEmptyPairingRow(nextGroupNumber, nextTime));
        nextGroupNumber += 1;
        nextTime = incrementTeeTimeHm(nextTime, 10);
      }
      return next;
    });
  };

  const removeRow = (row: PairingRowDraft) => {
    if (row.groupId) {
      deleteMutation.mutate(row.groupId, {
        onSuccess: () => {
          setDraftRows((prev) => prev.filter((entry) => entry.clientKey !== row.clientKey));
        },
      });
      return;
    }
    markDirty();
    setDraftRows((prev) => prev.filter((entry) => entry.clientKey !== row.clientKey));
  };

  const assignPlayerToSlot = (
    rowKey: string,
    side: 'a' | 'b',
    slotIndex: number,
    playerId: string
  ) => {
    const roster = side === 'a' ? sideATeam?.player_ids ?? [] : sideBTeam?.player_ids ?? [];
    if (!roster.includes(playerId)) return;

    const row = draftRows.find((entry) => entry.clientKey === rowKey);
    if (!row) return;

    const assignedElsewhere = getAssignedPlayerIdsInDraftRows(draftRows, rowKey);
    if (assignedElsewhere.has(playerId)) {
      Alert.alert('Already assigned', 'This player is already in another tee time this round.');
      return;
    }

    updateRow(rowKey, (entry) => {
      const sideAIds = Array.from(
        { length: playersPerMatch },
        (_, index) => entry.sideAPlayerIds[index] ?? ''
      );
      const sideBIds = Array.from(
        { length: playersPerMatch },
        (_, index) => entry.sideBPlayerIds[index] ?? ''
      );
      const target = side === 'a' ? sideAIds : sideBIds;
      const other = side === 'a' ? sideBIds : sideAIds;

      if (other.includes(playerId)) {
        Alert.alert('Wrong side', 'Player is already on the other side in this tee time.');
        return entry;
      }

      target[slotIndex] = playerId;
      for (let index = 0; index < target.length; index += 1) {
        if (index !== slotIndex && target[index] === playerId) {
          target[index] = '';
        }
      }

      return {
        ...entry,
        sideAPlayerIds: sideAIds,
        sideBPlayerIds: sideBIds,
      };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const clearSlot = (rowKey: string, side: 'a' | 'b', slotIndex: number) => {
    updateRow(rowKey, (entry) => {
      const sideAIds = Array.from(
        { length: playersPerMatch },
        (_, index) => entry.sideAPlayerIds[index] ?? ''
      );
      const sideBIds = Array.from(
        { length: playersPerMatch },
        (_, index) => entry.sideBPlayerIds[index] ?? ''
      );
      const target = side === 'a' ? sideAIds : sideBIds;
      target[slotIndex] = '';
      return {
        ...entry,
        sideAPlayerIds: sideAIds,
        sideBPlayerIds: sideBIds,
      };
    });
    setActiveSlot(null);
  };

  const handlePoolPlayerTap = (side: 'a' | 'b', playerId: string) => {
    if (!isManager) return;

    if (activeSlot && activeSlot.side === side) {
      assignPlayerToSlot(activeSlot.rowKey, side, activeSlot.slotIndex, playerId);
      setActiveSlot(null);
      return;
    }

    const targetRow = draftRows.find((row) => {
      const ids = side === 'a' ? row.sideAPlayerIds : row.sideBPlayerIds;
      const padded = Array.from({ length: playersPerMatch }, (_, index) => ids[index] ?? '');
      return padded.some((id) => !id);
    });

    if (!targetRow) {
      Alert.alert('No open slots', 'Add a tee time row or clear a slot first.');
      return;
    }

    const ids = side === 'a' ? targetRow.sideAPlayerIds : targetRow.sideBPlayerIds;
    const padded = Array.from({ length: playersPerMatch }, (_, index) => ids[index] ?? '');
    const slotIndex = padded.findIndex((id) => !id);
    if (slotIndex < 0) return;
    assignPlayerToSlot(targetRow.clientKey, side, slotIndex, playerId);
  };

  const handleSlotPress = (rowKey: string, side: 'a' | 'b', slotIndex: number, playerId?: string) => {
    if (!isManager) return;
    if (playerId) {
      clearSlot(rowKey, side, slotIndex);
      return;
    }
    setActiveSlot({ rowKey, side, slotIndex });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const addGuestPlayer = async () => {
    const name = guestName.trim();
    if (!name || !isManager) return;

    const rosterSide = guestSide === 'a' ? sideATeam : sideBTeam;
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
      handlePoolPlayerTap(guestSide, newPlayerId);
    }
  };

  const renderPoolColumn = (side: 'a' | 'b', team: TournamentTeam | undefined, title: string) => {
    const rosterIds = team?.player_ids ?? [];
    const availableIds = rosterIds.filter((id) => !assignedInDraft.has(id));

    return (
      <View className="flex-1 bg-[#141414] border border-neutral-800 rounded-xl p-3">
        <Text className="text-lime-400 font-bold text-sm mb-2">{title}</Text>
        <Text className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2">
          {availableIds.length} available
        </Text>
        {availableIds.length === 0 ? (
          <Text className="text-neutral-600 text-xs">All players assigned</Text>
        ) : (
          availableIds.map((playerId) => (
            <PlayerBadge
              key={playerId}
              label={memberNameById[playerId] ?? 'Player'}
              onPress={() => handlePoolPlayerTap(side, playerId)}
              disabled={!isManager}
            />
          ))
        )}
        {isManager && (
          <View className="mt-2 pt-2 border-t border-neutral-800">
            <TextInput
              value={guestSide === side ? guestName : ''}
              onChangeText={(value) => {
                setGuestSide(side);
                setGuestName(value);
              }}
              placeholder="Add guest"
              placeholderTextColor="#525252"
              className="bg-[#0c0c0c] border border-neutral-800 rounded-lg px-3 py-2 text-white text-xs mb-2"
            />
            <Pressable
              onPress={() => {
                setGuestSide(side);
                void addGuestPlayer();
              }}
              className="self-start px-3 py-1.5 rounded-lg bg-lime-900/30 border border-lime-700/50 active:opacity-80"
            >
              <Text className="text-lime-400 text-[10px] font-bold">Add guest</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  if (!sideATeam || !sideBTeam) {
    return (
      <View className="mx-5 mt-4 py-10 items-center bg-[#141414] rounded-2xl border border-neutral-800">
        <Users size={32} color="#525252" />
        <Text className="text-neutral-300 font-medium mt-3 text-center px-6">
          Create both teams on the Teams tab before setting up pairings.
        </Text>
      </View>
    );
  }

  return (
    <View className="mx-5 mt-2">
      <View className="bg-[#141414] border border-neutral-800 rounded-xl px-4 py-3 mb-4">
        <Text className="text-neutral-300 text-sm">
          Set tee times and pairings here on the Matches tab. This is the source of truth for when
          each foursome plays — not the member Tee Times tab.
        </Text>
      </View>

      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">Round</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        <View className="flex-row gap-2">
          {Array.from({ length: tournament.rounds_count }, (_, i) => i + 1).map((n) => {
            const savedCount = allMatchGroups.filter((group) => group.round_number === n).length;
            return (
              <Pressable
                key={n}
                onPress={() => setRoundNumber(n)}
                className={cn(
                  'px-4 py-2 rounded-lg border min-w-[140px]',
                  roundNumber === n
                    ? 'bg-lime-900/40 border-lime-600'
                    : 'bg-[#141414] border-neutral-800'
                )}
              >
                <Text
                  className={cn(
                    'text-xs font-semibold',
                    roundNumber === n ? 'text-lime-400' : 'text-neutral-500'
                  )}
                >
                  Round {n}
                </Text>
                <Text
                  className={cn(
                    'text-[10px] mt-0.5',
                    roundNumber === n ? 'text-lime-400/80' : 'text-neutral-600'
                  )}
                  numberOfLines={2}
                >
                  {formatRoundPickerLabel(tournament, n)}
                </Text>
                {savedCount > 0 ? (
                  <Text className="text-neutral-500 text-[10px] mt-1">
                    {savedCount} pairing{savedCount !== 1 ? 's' : ''} saved
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className="bg-[#141414] rounded-xl border border-neutral-800 p-4 mb-4">
        <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-1">Round format</Text>
        <Text className="text-lime-400 font-semibold">
          {formatLabelFromSettings(roundFormat, formatSettings)}
        </Text>
        <Text className="text-neutral-400 text-sm mt-1">
          {playersPerMatch}v{playersPerMatch} foursomes ·{' '}
          {formatScoringHintFromSettings(roundFormat, formatSettings)}
        </Text>
      </View>

      <TournamentFormatRulesCard formatId={roundFormat} settings={formatSettings} compact />

      <Text className="text-neutral-500 text-xs uppercase tracking-widest mt-5 mb-2">
        Roster pools
      </Text>
      <View className="flex-row gap-3 mb-4">
        {renderPoolColumn('a', sideATeam, sideAName)}
        {renderPoolColumn('b', sideBTeam, sideBName)}
      </View>

      {isManager && activeSlot ? (
        <View className="bg-lime-900/20 border border-lime-700/40 rounded-xl px-3 py-2 mb-3">
          <Text className="text-lime-400 text-xs font-semibold">
            Tap a player in {activeSlot.side === 'a' ? sideAName : sideBName} to fill the selected
            slot
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-neutral-500 text-xs uppercase tracking-widest">Pairings board</Text>
        {isManager ? (
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => addRows(1)}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 active:opacity-80"
            >
              <Text className="text-lime-400 text-xs font-semibold">Add row</Text>
            </Pressable>
            <Pressable
              onPress={() => addRows(5)}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 active:opacity-80"
            >
              <Text className="text-lime-400 text-xs font-semibold">Add 5 rows</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {isLoading && savedGroupIds.length > 0 ? (
        <View className="py-6 items-center">
          <ActivityIndicator color="#a3e635" />
        </View>
      ) : null}

      {draftRows.length === 0 ? (
        <View className="py-10 items-center bg-[#141414] rounded-2xl border border-neutral-800 mb-4">
          <Text className="text-neutral-400">No tee times for this round yet</Text>
        </View>
      ) : (
        draftRows.map((row) => {
          const savedGroup = row.groupId ? savedGroupById[row.groupId] : undefined;
          const groupFormat = savedGroup
            ? getMatchGroupFormat(savedGroup, tournament)
            : roundFormat;
          const wins = row.groupId ? holeWinsByGroupId[row.groupId] : undefined;

          return (
            <View
              key={row.clientKey}
              className="bg-[#141414] border border-neutral-800 rounded-xl p-4 mb-3"
            >
              <View className="flex-row items-center gap-2 mb-3">
                {isManager ? (
                  <>
                    <TextInput
                      value={row.teeTime}
                      onChangeText={(value) =>
                        updateRow(row.clientKey, (entry) => ({ ...entry, teeTime: value }))
                      }
                      placeholder="08:00"
                      placeholderTextColor="#525252"
                      className="flex-1 bg-[#0c0c0c] border border-neutral-800 rounded-lg px-3 py-2 text-white"
                    />
                    <TextInput
                      value={row.startingHole}
                      onChangeText={(value) =>
                        updateRow(row.clientKey, (entry) => ({ ...entry, startingHole: value }))
                      }
                      keyboardType="number-pad"
                      placeholder="Hole"
                      placeholderTextColor="#525252"
                      className="w-16 bg-[#0c0c0c] border border-neutral-800 rounded-lg px-2 py-2 text-white text-center"
                    />
                  </>
                ) : (
                  <Text className="text-lime-400 font-bold flex-1">
                    {savedGroup
                      ? formatTeeAssignmentTime(savedGroup.tee_time)
                      : formatPairingRowTeeLabel(row.teeTime)}{' '}
                    · Hole {row.startingHole}
                  </Text>
                )}
                {isManager ? (
                  <Pressable onPress={() => removeRow(row)} className="p-1">
                    <Trash2 size={16} color="#737373" />
                  </Pressable>
                ) : null}
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">
                    {sideAName}
                  </Text>
                  <View className="flex-row flex-wrap gap-1">
                    {Array.from({ length: playersPerMatch }, (_, index) => {
                      const playerId = row.sideAPlayerIds[index] || undefined;
                      const isActive =
                        activeSlot?.rowKey === row.clientKey &&
                        activeSlot.side === 'a' &&
                        activeSlot.slotIndex === index;
                      return (
                        <SlotBadge
                          key={`${row.clientKey}-a-${index}`}
                          label={
                            playerId
                              ? memberNameById[playerId]?.split(' ')[0] ?? 'Player'
                              : `Slot ${index + 1}`
                          }
                          filled={Boolean(playerId)}
                          active={isActive}
                          onPress={() =>
                            handleSlotPress(row.clientKey, 'a', index, playerId)
                          }
                          disabled={!isManager}
                        />
                      );
                    })}
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">
                    {sideBName}
                  </Text>
                  <View className="flex-row flex-wrap gap-1">
                    {Array.from({ length: playersPerMatch }, (_, index) => {
                      const playerId = row.sideBPlayerIds[index] || undefined;
                      const isActive =
                        activeSlot?.rowKey === row.clientKey &&
                        activeSlot.side === 'b' &&
                        activeSlot.slotIndex === index;
                      return (
                        <SlotBadge
                          key={`${row.clientKey}-b-${index}`}
                          label={
                            playerId
                              ? memberNameById[playerId]?.split(' ')[0] ?? 'Player'
                              : `Slot ${index + 1}`
                          }
                          filled={Boolean(playerId)}
                          active={isActive}
                          onPress={() =>
                            handleSlotPress(row.clientKey, 'b', index, playerId)
                          }
                          disabled={!isManager}
                        />
                      );
                    })}
                  </View>
                </View>
              </View>

              {savedGroup && (savedGroup.match_points_a > 0 || savedGroup.match_points_b > 0) ? (
                <View className="mt-3 bg-lime-900/20 border border-lime-700/30 rounded-lg px-3 py-2">
                  <Text className="text-white text-sm font-semibold">
                    Match points: {sideAName} {savedGroup.match_points_a} –{' '}
                    {savedGroup.match_points_b} {sideBName}
                  </Text>
                </View>
              ) : null}

              {wins && wins.side_a + wins.side_b + wins.ties > 0 ? (
                <View className="mt-3 pt-3 border-t border-neutral-800">
                  <Text className="text-neutral-400 text-xs uppercase tracking-widest mb-1">
                    Holes won
                  </Text>
                  <Text className="text-white font-semibold">
                    {sideAName} {wins.side_a} – {wins.side_b} {sideBName}
                  </Text>
                </View>
              ) : null}

              {row.groupId ? (
                <View className="flex-row gap-2 mt-3">
                  {isSinglesFormat(groupFormat) ? (
                    <Pressable
                      onPress={() => openScorecard(row.groupId!)}
                      className="flex-1 flex-row items-center justify-center bg-lime-600 rounded-lg py-2.5 active:opacity-80"
                    >
                      <ClipboardList size={14} color="#fff" />
                      <Text className="text-white font-semibold text-xs ml-1.5">Enter Scores</Text>
                    </Pressable>
                  ) : (
                    (['side_a', 'side_b'] as const).map((matchSide) => (
                      <Pressable
                        key={matchSide}
                        onPress={() => openScorecard(row.groupId!, matchSide)}
                        className="flex-1 flex-row items-center justify-center bg-lime-900/40 border border-lime-700/50 rounded-lg py-2.5 active:opacity-80"
                      >
                        <ClipboardList size={14} color="#a3e635" />
                        <Text className="text-lime-400 font-semibold text-xs ml-1.5">
                          {getTeamSideDisplayName(matchSide, teams)}
                        </Text>
                      </Pressable>
                    ))
                  )}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      {isManager ? (
        <>
          {saveError ? <Text className="text-red-400 text-sm mb-3">{saveError}</Text> : null}
          <Pressable
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isDirty}
            className={cn(
              'flex-row items-center justify-center rounded-xl py-3.5 mb-4 active:opacity-80',
              isDirty ? 'bg-lime-600' : 'bg-neutral-800 opacity-60'
            )}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Save size={16} color="#fff" />
                <Text className="text-white font-bold ml-2">Save pairings</Text>
              </>
            )}
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
