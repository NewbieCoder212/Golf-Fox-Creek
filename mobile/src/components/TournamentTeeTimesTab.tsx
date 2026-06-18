import { useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Clock } from 'lucide-react-native';

import { formatTeeAssignmentTime } from '@/lib/tournament-tee-service';
import { useTournamentMatchGroupsQuery } from '@/hooks/useTournamentMatchGroupsQuery';
import { TournamentDataLoadError } from '@/components/TournamentDataLoadError';
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
import { getTeamSideTheme } from '@/lib/match-play-theme';
import type { Tournament, TournamentMatchGroup, TournamentTeam, TournamentTeamSide } from '@/types';
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

function PlayerNameList({
  names,
  alignEnd = false,
}: {
  names: string[];
  alignEnd?: boolean;
}) {
  if (names.length === 0) {
    return (
      <Text
        className={cn('text-neutral-500 italic text-xs mt-1', alignEnd && 'text-right')}
      >
        TBD
      </Text>
    );
  }

  return (
    <View className={cn('mt-1 gap-0.5', alignEnd && 'items-end')}>
      {names.map((name, index) => (
        <Text
          key={`${name}-${index}`}
          className={cn(
            'text-neutral-200 text-xs',
            name === 'TBD' && 'text-neutral-500 italic',
            alignEnd && 'text-right'
          )}
          numberOfLines={2}
        >
          {name}
        </Text>
      ))}
    </View>
  );
}

function TeamSidePanel({
  side,
  teamName,
  playerNames,
  showTeamName = true,
  alignEnd = false,
}: {
  side: TournamentTeamSide;
  teamName: string;
  playerNames: string[];
  showTeamName?: boolean;
  alignEnd?: boolean;
}) {
  const theme = getTeamSideTheme(side);

  return (
    <View
      className={cn('flex-1 px-3 py-2.5', alignEnd && 'items-end')}
      style={{
        backgroundColor: theme.panelBg,
        borderBottomWidth: 2,
        borderBottomColor: theme.color,
        ...(alignEnd
          ? { borderRightWidth: 3, borderRightColor: theme.color }
          : { borderLeftWidth: 3, borderLeftColor: theme.color }),
      }}
    >
      {showTeamName ? (
        <Text
          style={{ color: theme.color }}
          className={cn('font-bold text-sm', alignEnd && 'text-right')}
          numberOfLines={1}
        >
          {teamName}
        </Text>
      ) : null}
      <PlayerNameList names={playerNames} alignEnd={alignEnd} />
    </View>
  );
}

function SinglesPairingRow({
  sideAName,
  sideBName,
  playerAId,
  playerBId,
  playerNameById,
  showTeamNames,
}: {
  sideAName: string;
  sideBName: string;
  playerAId?: string;
  playerBId?: string;
  playerNameById: Record<string, string>;
  showTeamNames: boolean;
}) {
  const themeA = getTeamSideTheme('side_a');
  const themeB = getTeamSideTheme('side_b');
  const playerA = formatPlayerName(playerAId, playerNameById);
  const playerB = formatPlayerName(playerBId, playerNameById);

  return (
    <View className="flex-row items-stretch">
      <View
        className="flex-1 px-3 py-2 justify-center"
        style={{
          backgroundColor: themeA.panelBg,
          borderLeftWidth: 3,
          borderLeftColor: themeA.color,
        }}
      >
        {showTeamNames ? (
          <Text style={{ color: themeA.color }} className="font-bold text-sm" numberOfLines={1}>
            {sideAName}
          </Text>
        ) : null}
        <Text
          className={cn(
            'text-neutral-100 text-xs font-medium',
            showTeamNames ? 'mt-0.5' : '',
            playerA === 'TBD' && 'text-neutral-500 italic'
          )}
          numberOfLines={2}
        >
          {playerA}
        </Text>
      </View>

      <View className="items-center justify-center px-1.5 bg-[#111] border-x border-neutral-800">
        <Text className="text-neutral-600 text-[8px] font-bold">VS</Text>
      </View>

      <View
        className="flex-1 px-3 py-2 justify-center items-end"
        style={{
          backgroundColor: themeB.panelBg,
          borderRightWidth: 3,
          borderRightColor: themeB.color,
        }}
      >
        {showTeamNames ? (
          <Text
            style={{ color: themeB.color }}
            className="font-bold text-sm text-right"
            numberOfLines={1}
          >
            {sideBName}
          </Text>
        ) : null}
        <Text
          className={cn(
            'text-neutral-100 text-xs font-medium text-right',
            showTeamNames ? 'mt-0.5' : '',
            playerB === 'TBD' && 'text-neutral-500 italic'
          )}
          numberOfLines={2}
        >
          {playerB}
        </Text>
      </View>
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
    <View className="rounded-xl overflow-hidden border border-neutral-800 bg-[#0a0a0a] mb-2">
      <View className="flex-row items-center justify-between px-3 py-2.5 bg-[#111] border-b border-neutral-800">
        <View className="flex-row items-center">
          <Text className="text-white font-bold text-lg">
            {formatTeeAssignmentTime(slot.teeTime)}
          </Text>
          <Text className="text-neutral-500 text-sm ml-3">Hole {slot.startingHole}</Text>
        </View>
        <Text className="text-neutral-600 text-xs">Group {slot.groupNumber}</Text>
      </View>

      {isSinglesRound ? (
        <View className="gap-px bg-neutral-800">
          {Array.from({ length: playersPerMatch }, (_, index) => (
            <SinglesPairingRow
              key={`${slot.id}-pair-${index}`}
              sideAName={sideAName}
              sideBName={sideBName}
              playerAId={slot.sideAPlayerIds[index]}
              playerBId={slot.sideBPlayerIds[index]}
              playerNameById={playerNameById}
              showTeamNames={index === 0}
            />
          ))}
        </View>
      ) : (
        <View className="flex-row items-stretch">
          <TeamSidePanel
            side="side_a"
            teamName={sideAName}
            playerNames={slot.sideAPlayerIds.map((id) => formatPlayerName(id, playerNameById))}
          />
          <View className="items-center justify-center px-2 bg-[#111] border-x border-neutral-800">
            <Text className="text-neutral-600 text-[9px] font-bold tracking-widest">VS</Text>
          </View>
          <TeamSidePanel
            side="side_b"
            teamName={sideBName}
            playerNames={slot.sideBPlayerIds.map((id) => formatPlayerName(id, playerNameById))}
            alignEnd
          />
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

  const {
    data: fetchedGroups = [],
    isPending,
    isError,
    error,
    refetch,
  } = useTournamentMatchGroupsQuery(tournamentId, {
    enabled: matchGroupsProp === undefined,
    refetchInterval: 30_000,
  });

  const matchGroups = matchGroupsProp ?? fetchedGroups;
  const isLoading = matchGroupsProp === undefined && isPending;

  const { data: formatsSettings } = useTournamentFormatsSettings();
  const roundFormat = getRoundFormat(tournament, roundNumber);
  const isSinglesRound = isSinglesFormat(roundFormat);
  const roundFormatDef = resolveFormatDefinition(roundFormat, formatsSettings);
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

  if (isError && matchGroupsProp === undefined) {
    return (
      <View className="mx-5 mt-2">
        <TournamentDataLoadError
          title="Could not load tee times"
          message={error instanceof Error ? error.message : 'Try logging in again.'}
          onRetry={() => void refetch()}
        />
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
