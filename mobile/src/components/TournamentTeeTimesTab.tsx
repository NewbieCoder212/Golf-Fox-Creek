import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
} from 'react-native';
import { Clock, ExternalLink, Plus, Save, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { buildClubTeeTimeIso, clubTimeInputValue } from '@/lib/club-timezone';
import {
  formatTeeAssignmentTime,
  getTournamentTeeAssignments,
  saveTournamentTeeAssignment,
} from '@/lib/tournament-tee-service';
import { formatRoundPickerLabel, getRoundFormat } from '@/lib/tournament-labels';
import { getDayNumberForRound } from '@/lib/tournament-schedule';
import type { Tournament, TournamentTeam, TournamentTeeAssignment } from '@/types';
import { cn } from '@/lib/cn';

const CHRONOGOLF_BOOKING_URL = 'https://www.chronogolf.ca/club/fox-creek-golf-club';

interface MemberOption {
  id: string;
  full_name: string;
}

interface TournamentTeeTimesTabProps {
  tournamentId: string;
  tournament: Tournament;
  teams: TournamentTeam[];
  members: MemberOption[];
  isManager: boolean;
}

function timeFromIso(iso: string): string {
  return clubTimeInputValue(iso);
}

interface AssigneeRow {
  key: string;
  label: string;
  teamId: string | null;
  userId: string | null;
  assignment: TournamentTeeAssignment | undefined;
}

export function TournamentTeeTimesTab({
  tournamentId,
  tournament,
  teams,
  members,
  isManager,
}: TournamentTeeTimesTabProps) {
  const queryClient = useQueryClient();
  const [roundNumber, setRoundNumber] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, { time: string; hole: string; notes: string }>>(
    {}
  );
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  const memberNameById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m.full_name])),
    [members]
  );

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['tournamentTeeAssignments', tournamentId, roundNumber],
    queryFn: () => getTournamentTeeAssignments(tournamentId, roundNumber),
  });

  const roundFormat = getRoundFormat(tournament, roundNumber);
  const dayNumber = getDayNumberForRound(tournament.round_schedule, roundNumber);

  const assignees = useMemo((): AssigneeRow[] => {
    if (roundFormat === 'singles') {
      const userIds = new Set(assignments.filter((a) => a.user_id).map((a) => a.user_id!));
      return Array.from(userIds).map((userId) => ({
        key: userId,
        label: memberNameById[userId] ?? 'Player',
        teamId: null,
        userId,
        assignment: assignments.find((a) => a.user_id === userId),
      }));
    }

    return teams.map((team) => ({
      key: team.id,
      label: team.team_name,
      teamId: team.id,
      userId: null,
      assignment: assignments.find((a) => a.team_id === team.id),
    }));
  }, [roundFormat, teams, assignments, memberNameById]);

  const sortedDisplay = useMemo(() => {
    return [...assignments].sort(
      (a, b) => new Date(a.tee_time).getTime() - new Date(b.tee_time).getTime()
    );
  }, [assignments]);

  useEffect(() => {
    const next: Record<string, { time: string; hole: string; notes: string }> = {};
    for (const row of assignees) {
      next[row.key] = {
        time: row.assignment ? timeFromIso(row.assignment.tee_time) : '08:00',
        hole: String(row.assignment?.starting_hole ?? 1),
        notes: row.assignment?.notes ?? '',
      };
    }
    setDrafts(next);
  }, [assignees, roundNumber]);

  const saveMutation = useMutation({
    mutationFn: saveTournamentTeeAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentTeeAssignments', tournamentId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleSave = (row: AssigneeRow) => {
    const draft = drafts[row.key];
    if (!draft) return;

    const hole = Math.min(18, Math.max(1, Number(draft.hole) || 1));

    saveMutation.mutate({
      tournament_id: tournamentId,
      round_number: roundNumber,
      team_id: row.teamId,
      user_id: row.userId,
      tee_time: buildClubTeeTimeIso(tournament.start_date, dayNumber, draft.time),
      starting_hole: hole,
      notes: draft.notes.trim() || null,
    });
  };

  const handleAddSinglesPlayer = (userId: string) => {
    setShowAddPlayer(false);
    saveMutation.mutate({
      tournament_id: tournamentId,
      round_number: roundNumber,
      user_id: userId,
      team_id: null,
      tee_time: buildClubTeeTimeIso(tournament.start_date, dayNumber, '08:00'),
      starting_hole: 1,
    });
  };

  const updateDraft = (key: string, field: 'time' | 'hole' | 'notes', value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const labelForAssignment = (a: TournamentTeeAssignment) => {
    if (a.team_id) return teams.find((t) => t.id === a.team_id)?.team_name ?? 'Team';
    if (a.user_id) return memberNameById[a.user_id] ?? 'Player';
    return 'Unknown';
  };

  if (isLoading) {
    return (
      <View className="py-16 items-center">
        <ActivityIndicator color="#a3e635" />
      </View>
    );
  }

  return (
    <View className="mx-5 mt-2">
      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">Round</Text>
      <View className="flex-row gap-2 mb-4">
        {Array.from({ length: tournament.rounds_count }, (_, i) => i + 1).map((n) => (
          <Pressable
            key={n}
            onPress={() => setRoundNumber(n)}
            className={cn(
              'px-4 py-2 rounded-lg border min-w-[72px] items-center',
              roundNumber === n
                ? 'bg-lime-900/40 border-lime-600'
                : 'bg-[#141414] border-neutral-800'
            )}
          >
            <Text
              className={cn(
                'font-semibold text-sm',
                roundNumber === n ? 'text-lime-400' : 'text-neutral-500'
              )}
            >
              {formatRoundPickerLabel(tournament, n)}
            </Text>
          </Pressable>
        ))}
      </View>

      {sortedDisplay.length === 0 ? (
        <View className="py-10 items-center bg-[#141414] rounded-2xl border border-neutral-800 mb-4">
          <Clock size={32} color="#525252" />
          <Text className="text-neutral-300 font-medium mt-3">Tee times not posted yet</Text>
          {isManager && (
            <Text className="text-neutral-500 text-sm text-center mt-2 px-6">
              Assign tee times below for {formatRoundPickerLabel(tournament, roundNumber)}.
            </Text>
          )}
        </View>
      ) : (
        sortedDisplay.map((assignment) => (
          <View
            key={assignment.id}
            className="flex-row items-center bg-[#141414] border border-neutral-800 rounded-xl p-4 mb-2"
          >
            <View className="w-16">
              <Text className="text-lime-400 font-bold text-lg">
                {formatTeeAssignmentTime(assignment.tee_time)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold">{labelForAssignment(assignment)}</Text>
              <Text className="text-neutral-500 text-xs mt-0.5">
                Hole {assignment.starting_hole}
                {assignment.notes ? ` · ${assignment.notes}` : ''}
              </Text>
            </View>
          </View>
        ))
      )}

      {isManager && (
        <View className="mt-4">
          <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">
            Assign Tee Times
          </Text>

          {roundFormat === 'singles' && (
            <Pressable
              onPress={() => setShowAddPlayer(true)}
              className="flex-row items-center justify-center border border-dashed border-neutral-700 rounded-xl py-3 mb-3 active:opacity-80"
            >
              <Plus size={16} color="#a3e635" />
              <Text className="text-lime-400 font-semibold ml-2">Add Player</Text>
            </Pressable>
          )}

          {roundFormat !== 'singles' && teams.length === 0 && (
            <Text className="text-neutral-500 text-sm mb-3">Add teams first, then assign tee times.</Text>
          )}

          {assignees.map((row) => {
            const draft = drafts[row.key] ?? { time: '08:00', hole: '1', notes: '' };
            return (
              <View
                key={row.key}
                className="bg-[#141414] border border-neutral-800 rounded-xl p-4 mb-3"
              >
                <Text className="text-white font-semibold mb-3">{row.label}</Text>
                <View className="flex-row gap-2 mb-2">
                  <View className="flex-1">
                    <Text className="text-neutral-500 text-xs mb-1">Time (HH:MM)</Text>
                    <TextInput
                      value={draft.time}
                      onChangeText={(v) => updateDraft(row.key, 'time', v)}
                      placeholder="08:30"
                      placeholderTextColor="#525252"
                      keyboardType="numbers-and-punctuation"
                      className="bg-[#0c0c0c] border border-neutral-800 rounded-lg px-3 py-2 text-white"
                    />
                  </View>
                  <View className="w-20">
                    <Text className="text-neutral-500 text-xs mb-1">Hole</Text>
                    <TextInput
                      value={draft.hole}
                      onChangeText={(v) => updateDraft(row.key, 'hole', v)}
                      keyboardType="number-pad"
                      className="bg-[#0c0c0c] border border-neutral-800 rounded-lg px-3 py-2 text-white text-center"
                    />
                  </View>
                </View>
                <TextInput
                  value={draft.notes}
                  onChangeText={(v) => updateDraft(row.key, 'notes', v)}
                  placeholder="Notes (optional)"
                  placeholderTextColor="#525252"
                  className="bg-[#0c0c0c] border border-neutral-800 rounded-lg px-3 py-2 text-white mb-3"
                />
                <Pressable
                  onPress={() => handleSave(row)}
                  disabled={saveMutation.isPending}
                  className="flex-row items-center justify-center bg-lime-600 rounded-lg py-2.5 active:opacity-80"
                >
                  {saveMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Save size={16} color="#fff" />
                      <Text className="text-white font-semibold ml-2">Save</Text>
                    </>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <Pressable
        onPress={() => Linking.openURL(CHRONOGOLF_BOOKING_URL)}
        className="mt-4 flex-row items-center justify-center py-3 active:opacity-70"
      >
        <ExternalLink size={14} color="#737373" />
        <Text className="text-neutral-500 text-sm ml-2">Book on Chronogolf</Text>
      </Pressable>

      <Modal visible={showAddPlayer} animationType="slide" transparent>
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#141414] rounded-t-3xl border-t border-neutral-800 px-5 pt-5 pb-10 max-h-[70%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-lg font-bold">Add Player</Text>
              <Pressable onPress={() => setShowAddPlayer(false)}>
                <X size={22} color="#737373" />
              </Pressable>
            </View>
            <ScrollView>
              {members
                .filter((m) => !assignees.some((a) => a.userId === m.id))
                .map((member) => (
                  <Pressable
                    key={member.id}
                    onPress={() => handleAddSinglesPlayer(member.id)}
                    className="px-4 py-3 rounded-xl mb-2 bg-[#0c0c0c] border border-neutral-800 active:opacity-80"
                  >
                    <Text className="text-white font-medium">{member.full_name}</Text>
                  </Pressable>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
