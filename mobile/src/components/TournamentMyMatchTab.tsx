import { useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { ClipboardList, Swords, Trophy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { formatTeeAssignmentTime } from '@/lib/tournament-tee-service';
import {
  formatRoundPickerLabel,
  getMatchGroupFormat,
  getRoundFormat,
  getTeamSideDisplayName,
  isSinglesFormat,
} from '@/lib/tournament-labels';
import {
  findMatchGroupForRosterPlayer,
  getActiveRoundNumber,
  resolveTournamentScorecardRoute,
} from '@/lib/tournament-scorecard-routing';
import { useScorecardTimeGate } from '@/hooks/useScorecardTimeGate';
import { formatLabelFromSettings, formatScoringHintFromSettings } from '@/lib/tournament-format-settings';
import { useTournamentFormatsSettings } from '@/lib/useTournamentFormatsSettings';
import {
  getMatchCompletionDetail,
  useMyMatchTabStatus,
} from '@/hooks/useMyMatchTabStatus';
import { getOpponentSide, getMatchWinnerTheme, getTeamSideTheme } from '@/lib/match-play-theme';
import { resolveMatchWinnerSide } from '@/lib/tournament-match-play-status';
import type { Tournament, TournamentMatchGroup, TournamentTeam, TournamentTeamSide } from '@/types';
import { cn } from '@/lib/cn';

interface TournamentMyMatchTabProps {
  tournamentId: string;
  userId: string;
  tournament: Tournament;
  teams: TournamentTeam[];
  matchGroups: TournamentMatchGroup[];
  rosterPlayerIds: string[];
  playerNameById: Record<string, string>;
  defaultRoundNumber?: number;
  bypassScorecardTimeGate?: boolean;
  onViewStandings: () => void;
}

function formatName(playerId: string | undefined, playerNameById: Record<string, string>): string {
  if (!playerId) return 'TBD';
  return playerNameById[playerId] ?? 'TBD';
}

function findSinglesOpponentIndex(
  group: TournamentMatchGroup,
  side: TournamentTeamSide,
  rosterPlayerIds: string[]
): number {
  const myIds = new Set(rosterPlayerIds);
  const mySideIds = side === 'side_a' ? group.side_a_player_ids : group.side_b_player_ids;
  return mySideIds.findIndex((id) => myIds.has(id));
}

export function TournamentMyMatchTab({
  tournamentId,
  userId,
  tournament,
  teams,
  matchGroups,
  rosterPlayerIds,
  playerNameById,
  defaultRoundNumber,
  bypassScorecardTimeGate = false,
  onViewStandings,
}: TournamentMyMatchTabProps) {
  const router = useRouter();
  const [roundNumber, setRoundNumber] = useState(
    defaultRoundNumber ?? getActiveRoundNumber(tournament)
  );
  const [isOpeningScorecard, setIsOpeningScorecard] = useState(false);

  const { data: formatSettings } = useTournamentFormatsSettings();
  const roundFormat = getRoundFormat(tournament, roundNumber);

  const assignment = useMemo(
    () => findMatchGroupForRosterPlayer(matchGroups, rosterPlayerIds, roundNumber),
    [matchGroups, rosterPlayerIds, roundNumber]
  );

  const sideAName = getTeamSideDisplayName('side_a', teams);
  const sideBName = getTeamSideDisplayName('side_b', teams);

  const handleEnterScores = async () => {
    if (!assignment) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpeningScorecard(true);
    try {
      const route = await resolveTournamentScorecardRoute(tournamentId, userId, roundNumber);
      router.push(route as never);
    } finally {
      setIsOpeningScorecard(false);
    }
  };

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

      {!assignment ? (
        <View className="py-10 items-center bg-[#141414] rounded-2xl border border-neutral-800">
          <Swords size={32} color="#525252" />
          <Text className="text-neutral-300 font-medium mt-3">No match assigned yet</Text>
          <Text className="text-neutral-500 text-sm text-center mt-2 px-6">
            Check the Schedule tab for tee times, or contact your captain if you expected a pairing
            for {formatRoundPickerLabel(tournament, roundNumber)}.
          </Text>
        </View>
      ) : (
        <MyMatchCard
          tournament={tournament}
          group={assignment.group}
          viewerSide={assignment.side}
          rosterPlayerIds={rosterPlayerIds}
          sideAName={sideAName}
          sideBName={sideBName}
          playerNameById={playerNameById}
          roundNumber={roundNumber}
          roundFormat={roundFormat}
          formatSettings={formatSettings}
          isOpeningScorecard={isOpeningScorecard}
          bypassScorecardTimeGate={bypassScorecardTimeGate}
          onEnterScores={handleEnterScores}
          onViewStandings={onViewStandings}
        />
      )}
    </View>
  );
}

interface MyMatchCardProps {
  tournament: Tournament;
  group: TournamentMatchGroup;
  viewerSide: TournamentTeamSide;
  rosterPlayerIds: string[];
  sideAName: string;
  sideBName: string;
  playerNameById: Record<string, string>;
  roundNumber: number;
  roundFormat: string;
  formatSettings: ReturnType<typeof useTournamentFormatsSettings>['data'];
  isOpeningScorecard: boolean;
  bypassScorecardTimeGate?: boolean;
  onEnterScores: () => void;
  onViewStandings: () => void;
}

function MyMatchCard({
  tournament,
  group,
  viewerSide,
  rosterPlayerIds,
  sideAName,
  sideBName,
  playerNameById,
  roundNumber,
  roundFormat,
  formatSettings,
  isOpeningScorecard,
  bypassScorecardTimeGate = false,
  onEnterScores,
  onViewStandings,
}: MyMatchCardProps) {
  const router = useRouter();
  const { open: scoreEntryOpen, hint: scorecardClosedHint } = useScorecardTimeGate({
    tournament,
    matchGroup: group,
    bypassTimeGate: bypassScorecardTimeGate,
  });
  const groupFormat = getMatchGroupFormat(group, tournament);
  const mySideName = viewerSide === 'side_a' ? sideAName : sideBName;
  const oppSideName = viewerSide === 'side_a' ? sideBName : sideAName;

  const { matchStatus, isComplete } = useMyMatchTabStatus({
    tournament,
    group,
    roundNumber,
    viewerSide,
    rosterPlayerIds,
    sideAName,
    sideBName,
    playerNameById,
  });

  const completionDetail = isComplete
    ? getMatchCompletionDetail(matchStatus, viewerSide, mySideName, oppSideName, group)
    : null;
  const winnerSide = isComplete ? resolveMatchWinnerSide(group, matchStatus) : null;
  const winnerTheme = getMatchWinnerTheme(winnerSide);
  const myPlayerIds =
    viewerSide === 'side_a' ? group.side_a_player_ids : group.side_b_player_ids;
  const oppPlayerIds =
    viewerSide === 'side_a' ? group.side_b_player_ids : group.side_a_player_ids;

  const myRosterSet = new Set(rosterPlayerIds);
  const myPlayerId = myPlayerIds.find((id) => myRosterSet.has(id));

  let singlesContent: { myLabel: string; oppLabel: string } | null = null;
  if (isSinglesFormat(groupFormat) && myPlayerId) {
    const slotIndex = findSinglesOpponentIndex(group, viewerSide, rosterPlayerIds);
    const oppId = slotIndex >= 0 ? oppPlayerIds[slotIndex] : undefined;
    singlesContent = {
      myLabel: formatName(myPlayerId, playerNameById),
      oppLabel: formatName(oppId, playerNameById),
    };
  }

  const teammates = myPlayerIds.filter((id) => id !== myPlayerId && id);
  const myTheme = getTeamSideTheme(viewerSide);
  const oppTheme = getTeamSideTheme(getOpponentSide(viewerSide));

  const renderTeamPanel = (
    label: string,
    content: string,
    theme: ReturnType<typeof getTeamSideTheme>,
    alignEnd = false
  ) => (
    <View
      className={cn('flex-1 rounded-lg px-3 py-3', alignEnd && 'items-end')}
      style={{
        backgroundColor: theme.panelBg,
        borderWidth: 1,
        borderColor: theme.panelBorder,
      }}
    >
      <Text
        style={{ color: theme.colorLight }}
        className="text-[10px] font-bold uppercase tracking-widest mb-1"
      >
        {label}
      </Text>
      <Text className="text-white text-sm font-semibold" numberOfLines={2}>
        {content}
      </Text>
    </View>
  );

  return (
    <View
      className={cn('bg-[#141414] border rounded-xl p-4', !isComplete && 'border-neutral-800')}
      style={
        isComplete
          ? { borderColor: winnerTheme.panelBorder, borderWidth: 1 }
          : undefined
      }
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 pr-3">
          {isComplete ? (
            <View
              className="self-start rounded-full px-3 py-1 mb-2 border"
              style={{
                backgroundColor: winnerTheme.ringGlow,
                borderColor: winnerTheme.ringBorder,
              }}
            >
              <Text
                style={{ color: winnerTheme.colorLight }}
                className="text-[10px] font-bold uppercase tracking-widest"
              >
                Match Complete
              </Text>
            </View>
          ) : null}
          <Text
            className={cn(
              'font-bold text-xl',
              isComplete ? 'text-neutral-300' : 'text-lime-400'
            )}
          >
            {formatTeeAssignmentTime(group.tee_time)}
          </Text>
          <Text className="text-neutral-500 text-sm mt-0.5">
            Hole {group.starting_hole} · Group {group.group_number}
          </Text>
          {isComplete ? (
            <Text
              style={{ color: winnerTheme.color }}
              className="text-sm font-semibold mt-2"
            >
              {matchStatus.label}
            </Text>
          ) : matchStatus.throughHole > 0 ? (
            <Text className="text-neutral-400 text-sm mt-2">{matchStatus.label}</Text>
          ) : null}
        </View>
        <Text className="text-neutral-600 text-xs uppercase tracking-widest pt-1">
          {isComplete ? 'Final' : 'Your match'}
        </Text>
      </View>

      <View className="bg-[#0c0c0c] rounded-lg px-3 py-2.5 border border-neutral-800/80 mb-3">
        <Text className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">
          Format
        </Text>
        <Text className="text-lime-400 font-semibold text-sm">
          {formatLabelFromSettings(roundFormat, formatSettings)}
        </Text>
        <Text className="text-neutral-400 text-xs mt-1">
          {formatScoringHintFromSettings(roundFormat, formatSettings)}
        </Text>
      </View>

      {singlesContent ? (
        <View className="flex-row items-center gap-2 mb-3">
          {renderTeamPanel('You', singlesContent.myLabel, myTheme)}
          <Text className="text-neutral-500 text-xs font-bold uppercase">vs</Text>
          {renderTeamPanel('Opponent', singlesContent.oppLabel, oppTheme, true)}
        </View>
      ) : (
        <View className="flex-row gap-2 mb-3">
          {renderTeamPanel(
            `${mySideName} (you)`,
            myPlayerIds.map((id) => formatName(id, playerNameById)).join(', '),
            myTheme
          )}
          {renderTeamPanel(
            oppSideName,
            oppPlayerIds.map((id) => formatName(id, playerNameById)).join(', '),
            oppTheme,
            true
          )}
        </View>
      )}

      {teammates.length > 0 && !singlesContent ? (
        <Text className="text-neutral-500 text-xs mb-3">
          Playing with: {teammates.map((id) => formatName(id, playerNameById)).join(', ')}
        </Text>
      ) : null}

      {isComplete ? (
        <View
          className="rounded-xl px-4 py-4 border"
          style={{
            backgroundColor: winnerTheme.ringGlow,
            borderColor: winnerTheme.panelBorder,
          }}
        >
          <View className="flex-row items-center justify-center mb-2">
            <Trophy size={18} color={winnerTheme.color} />
            <Text style={{ color: winnerTheme.color }} className="font-bold text-base ml-2">
              Match finished
            </Text>
          </View>
          <Text style={{ color: winnerTheme.color }} className="font-semibold text-center text-base">
            {matchStatus.label}
          </Text>
          {completionDetail ? (
            <Text className="text-neutral-400 text-sm text-center mt-2">{completionDetail}</Text>
          ) : null}
          <Text className="text-neutral-500 text-xs text-center mt-3">
            Need to fix a hole? Open the scorecard and tap the hole to update.
          </Text>
          <Pressable
            onPress={onEnterScores}
            disabled={isOpeningScorecard}
            className="mt-4 flex-row items-center justify-center rounded-xl py-3.5 active:opacity-80 bg-lime-600"
          >
            {isOpeningScorecard ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <ClipboardList size={18} color="#fff" />
                <Text className="text-white font-bold text-base ml-2">Edit scorecard</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={onViewStandings}
            className="mt-2 flex-row items-center justify-center border border-neutral-700 rounded-xl py-3 active:opacity-80"
          >
            <Text className="text-neutral-200 font-semibold text-sm">View standings</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {scorecardClosedHint ? (
            <Text className="text-neutral-500 text-xs text-center mb-3">{scorecardClosedHint}</Text>
          ) : null}
          <Pressable
            onPress={onEnterScores}
            disabled={isOpeningScorecard}
            className="flex-row items-center justify-center rounded-xl py-3.5 active:opacity-80 bg-lime-600"
          >
            {isOpeningScorecard ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <ClipboardList size={18} color="#fff" />
                <Text className="text-white font-bold text-base ml-2">
                  {scoreEntryOpen ? 'Enter scores' : 'Open scorecard'}
                </Text>
              </>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}
