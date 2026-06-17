import { useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Clock } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';

import { getTournamentMatchGroups } from '@/lib/tournament-match-service';
import { formatTeeAssignmentTime } from '@/lib/tournament-tee-service';
import {
  formatRoundPickerLabel,
  getRoundFormat,
  getTeamSideDisplayName,
  isSinglesFormat,
} from '@/lib/tournament-labels';
import {
  buildScheduleTeeTimeSlots,
  type ScheduleTeeTimeSlot,
} from '@/lib/tournament-schedule-slots';
import { resolveFormatDefinition } from '@/lib/tournament-format-settings';
import { useTournamentFormatsSettings } from '@/lib/useTournamentFormatsSettings';
import { getActiveRoundNumber } from '@/lib/tournament-scorecard-routing';
import type { Tournament, TournamentMatchGroup, TournamentTeam } from '@/types';
import { cn } from '@/lib/cn';

interface TournamentTeeTimesTabProps {
  tournamentId: string;
  tournament: Tournament;
  teams: TournamentTeam[];
  playerNameById: Record<string, string>;
  matchGroups?: TournamentMatchGroup[];
  defaultRoundNumber?: number;
}

function formatPlayerName(
  playerId: string | undefined,
  playerNameById: Record<string, string>
): string {
  if (!playerId) return 'TBD';
  return playerNameById[playerId] ?? 'TBD';
}

function PlayerNameSlot({ sideLabel, name }: { sideLabel: string; name: string }) {
  const isOpen = name === 'TBD';
  return (
    <View className="flex-1 bg-[#0c0c0c] rounded-lg px-3 py-2.5 border border-neutral-800/80 min-h-[52px] justify-center">
      <Text className="text-lime-400/80 text-[10px] font-bold uppercase tracking-widest mb-1">
        {sideLabel}
      </Text>
      <Text
        className={cn(
          'text-sm font-semibold',
          isOpen ? 'text-neutral-500 italic' : 'text-neutral-100'
        )}
        numberOfLines={2}
      >
        {name}
      </Text>
    </View>
  );
}

function SinglesPairingRow({
  sideAName,
  sideBName,
  playerAId,
  playerBId,
  playerNameById,
  pairingIndex,
}: {
  sideAName: string;
  sideBName: string;
  playerAId?: string;
  playerBId?: string;
  playerNameById: Record<string, string>;
  pairingIndex: number;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <PlayerNameSlot
        sideLabel={`${sideAName}-${pairingIndex + 1}`}
        name={formatPlayerName(playerAId, playerNameById)}
      />
      <Text className="text-neutral-500 text-xs font-bold uppercase">vs</Text>
      <PlayerNameSlot
        sideLabel={`${sideBName}-${pairingIndex + 1}`}
        name={formatPlayerName(playerBId, playerNameById)}
      />
    </View>
  );
}

function TeeTimeRow({
  slot,
  isSinglesRound,
  playersPerMatch,
  teams,
  playerNameById,
}: {
  slot: ScheduleTeeTimeSlot;
  isSinglesRound: boolean;
  playersPerMatch: number;
  teams: TournamentTeam[];
  playerNameById: Record<string, string>;
}) {
  const sideAName = getTeamSideDisplayName('side_a', teams);
  const sideBName = getTeamSideDisplayName('side_b', teams);

  return (
    <View className="bg-[#141414] border border-neutral-800 rounded-xl p-4 mb-2">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Text className="text-lime-400 font-bold text-xl">
            {formatTeeAssignmentTime(slot.teeTime)}
          </Text>
          <Text className="text-neutral-500 text-sm ml-3">Hole {slot.startingHole}</Text>
        </View>
        <Text className="text-neutral-600 text-xs">Group {slot.groupNumber}</Text>
      </View>

      {isSinglesRound ? (
        <View className="gap-2">
          {Array.from({ length: playersPerMatch }, (_, index) => (
            <SinglesPairingRow
              key={`${slot.id}-pair-${index}`}
              sideAName={sideAName}
              sideBName={sideBName}
              playerAId={slot.sideAPlayerIds[index]}
              playerBId={slot.sideBPlayerIds[index]}
              playerNameById={playerNameById}
              pairingIndex={index}
            />
          ))}
        </View>
      ) : (
        <View className="flex-row gap-3">
          <View className="flex-1 bg-[#0c0c0c] rounded-lg p-3 border border-neutral-800/80">
            <Text className="text-lime-400/80 text-[10px] font-bold uppercase tracking-widest mb-1.5">
              {sideAName}
            </Text>
            <Text className="text-neutral-200 text-sm font-body" numberOfLines={3}>
              {slot.sideAPlayerIds
                .map((id) => formatPlayerName(id, playerNameById))
                .join(', ')}
            </Text>
          </View>
          <View className="flex-1 bg-[#0c0c0c] rounded-lg p-3 border border-neutral-800/80">
            <Text className="text-lime-400/80 text-[10px] font-bold uppercase tracking-widest mb-1.5">
              {sideBName}
            </Text>
            <Text className="text-neutral-200 text-sm font-body" numberOfLines={3}>
              {slot.sideBPlayerIds
                .map((id) => formatPlayerName(id, playerNameById))
                .join(', ')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export function TournamentTeeTimesTab({
  tournamentId,
  tournament,
  teams,
  playerNameById,
  matchGroups: matchGroupsProp,
  defaultRoundNumber,
}: TournamentTeeTimesTabProps) {
  const [roundNumber, setRoundNumber] = useState(
    defaultRoundNumber ?? getActiveRoundNumber(tournament)
  );

  const { data: fetchedGroups = [], isPending } = useQuery({
    queryKey: ['tournamentMatchGroups', tournamentId],
    queryFn: () => getTournamentMatchGroups(tournamentId),
    enabled: Boolean(tournamentId) && matchGroupsProp === undefined,
    refetchInterval: 30_000,
  });

  const matchGroups = matchGroupsProp ?? fetchedGroups;
  const isLoading = matchGroupsProp === undefined && isPending;

  const { data: formatsSettings } = useTournamentFormatsSettings();
  const roundFormat = getRoundFormat(tournament, roundNumber);
  const isSinglesRound = isSinglesFormat(roundFormat);
  const roundFormatDef = resolveFormatDefinition(formatsSettings, roundFormat);
  const playersPerMatch =
    roundFormatDef?.default_players_per_match ?? tournament.players_per_match ?? 2;

  const scheduleSlots = useMemo(
    () =>
      buildScheduleTeeTimeSlots(
        matchGroups.filter((group) => group.round_number === roundNumber),
        { mergeSinglesFoursomes: isSinglesRound }
      ),
    [matchGroups, roundNumber, isSinglesRound]
  );

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
      <View className="flex-row flex-wrap gap-2 mb-4">
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

      {scheduleSlots.length === 0 ? (
        <View className="py-10 items-center bg-[#141414] rounded-2xl border border-neutral-800">
          <Clock size={32} color="#525252" />
          <Text className="text-neutral-300 font-medium mt-3">Tee times not posted yet</Text>
          <Text className="text-neutral-500 text-sm text-center mt-2 px-6">
            Check back once pairings are published for {formatRoundPickerLabel(tournament, roundNumber)}.
          </Text>
        </View>
      ) : (
        scheduleSlots.map((slot) => (
          <TeeTimeRow
            key={slot.id}
            slot={slot}
            isSinglesRound={isSinglesRound}
            playersPerMatch={playersPerMatch}
            teams={teams}
            playerNameById={playerNameById}
          />
        ))
      )}
    </View>
  );
}
