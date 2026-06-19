import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { ClipboardList, Trophy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import {
  getMatchCompletionDetail,
  useMyMatchTabStatus,
} from '@/hooks/useMyMatchTabStatus';
import { formatTeeTimeLabel } from '@/lib/tournament-scorecard-routing';
import { getTeamSideDisplayName } from '@/lib/tournament-labels';
import { getMatchWinnerTheme } from '@/lib/match-play-theme';
import { resolveMatchWinnerSide } from '@/lib/tournament-match-play-status';
import type { Tournament, TournamentTeam, TournamentTeamSide } from '@/types';
import type { TournamentMatchGroup } from '@/types';
import { cn } from '@/lib/cn';

interface TournamentEventMatchActionsProps {
  tournament: Tournament;
  group: TournamentMatchGroup;
  viewerSide: TournamentTeamSide;
  roundNumber: number;
  rosterPlayerIds: string[];
  teams: TournamentTeam[];
  playerNameById: Record<string, string>;
  scoreEntryOpen: boolean;
  scorecardClosedHint?: string | null;
  isOpeningScorecard: boolean;
  onEnterScores: () => void;
  onViewStandings: () => void;
}

export function TournamentEventMatchActions({
  tournament,
  group,
  viewerSide,
  roundNumber,
  rosterPlayerIds,
  teams,
  playerNameById,
  scoreEntryOpen,
  scorecardClosedHint = null,
  isOpeningScorecard,
  onEnterScores,
  onViewStandings,
}: TournamentEventMatchActionsProps) {
  const sideAName = getTeamSideDisplayName('side_a', teams);
  const sideBName = getTeamSideDisplayName('side_b', teams);
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

  const resultLabel =
    matchStatus.throughHole > 0
      ? matchStatus.label
      : group.match_winner === 'tie'
        ? 'Match halved'
        : group.match_winner === 'side_a'
          ? `${sideAName} won`
          : group.match_winner === 'side_b'
            ? `${sideBName} won`
            : null;

  return (
    <View>
      <View
        className={cn(
          'rounded-xl px-4 py-3 mb-3 border',
          !isComplete && 'bg-lime-900/20 border-lime-700/40'
        )}
        style={
          isComplete
            ? {
                backgroundColor: winnerTheme.panelBg,
                borderColor: winnerTheme.panelBorder,
              }
            : undefined
        }
      >
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
            'text-sm font-semibold',
            isComplete ? 'text-neutral-200' : 'text-lime-400'
          )}
        >
          Your group · Tee {formatTeeTimeLabel(group.tee_time)} · Hole {group.starting_hole}
        </Text>
        {isComplete && resultLabel ? (
          <Text style={{ color: winnerTheme.color }} className="font-bold text-base mt-2">
            {resultLabel}
          </Text>
        ) : matchStatus.throughHole > 0 ? (
          <Text className="text-neutral-300 text-sm mt-2">{matchStatus.label}</Text>
        ) : (
          <Text className="text-neutral-500 text-xs mt-1">
            {isComplete
              ? 'This match is final — standings updated.'
              : scorecardClosedHint ?? 'Scorecard opens with your foursome and pairings'}
          </Text>
        )}
        {isComplete && completionDetail ? (
          <Text className="text-neutral-400 text-xs mt-1">{completionDetail}</Text>
        ) : null}
      </View>

      {isComplete ? (
        <View
          className="rounded-xl px-4 py-4 border"
          style={{
            backgroundColor: winnerTheme.ringGlow,
            borderColor: winnerTheme.panelBorder,
          }}
        >
          <View className="flex-row items-center justify-center mb-1">
            <Trophy size={18} color={winnerTheme.color} />
            <Text style={{ color: winnerTheme.color }} className="font-bold text-base ml-2">
              Match finished
            </Text>
          </View>
          <Text className="text-neutral-500 text-xs text-center">
            Tap a hole on the scorecard to correct a result.
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onEnterScores();
            }}
            disabled={isOpeningScorecard}
            className="mt-3 flex-row items-center justify-center rounded-xl py-3.5 active:opacity-80 bg-lime-600"
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
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onViewStandings();
            }}
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
            className="flex-row items-center justify-center rounded-xl py-4 bg-lime-600 active:opacity-80"
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
  );
}
