import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  buildMatchStatusFromHoleResults,
  formatMatchResultSummary,
  resolveEffectiveGroupHoleResults,
  resolveMatchGroupDisplayStatus,
  resolveMatchWinnerSide,
  type MatchGroupDisplayTone,
  type MatchPlayStatus,
} from '@/lib/tournament-match-play-status';
import { getMatchHoleResultsForGroups } from '@/lib/tournament-match-service';
import {
  getMatchGroupFormat,
  getTeamSideDisplayName,
  isSinglesFormat,
} from '@/lib/tournament-labels';
import { buildPairingMatchStatus } from '@/lib/tournament-pairing-status';
import type { MatchStatus } from '@/lib/tournament-match-status';
import type {
  Tournament,
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentScore,
  TournamentTeam,
} from '@/types';

export type RoundMatchSinglesPairing = {
  pairingIndex: number;
  sideAPlayer: string;
  sideBPlayer: string;
  matchStatus: MatchStatus;
  playStatus: MatchPlayStatus;
  resultSummary: string | null;
  winnerSide: ReturnType<typeof resolveMatchWinnerSide>;
};

export type RoundMatchLineup =
  | { kind: 'team'; sideAPlayers: string[]; sideBPlayers: string[] }
  | { kind: 'singles'; pairings: RoundMatchSinglesPairing[] };

export type RoundMatchSummary = {
  group: TournamentMatchGroup;
  sideAName: string;
  sideBName: string;
  lineup: RoundMatchLineup;
  playStatus: MatchPlayStatus;
  statusLabel: string;
  displayTone: MatchGroupDisplayTone;
  resultSummary: string | null;
  matchStatus: MatchStatus;
  winnerSide: ReturnType<typeof resolveMatchWinnerSide>;
};

function formatPlayerName(
  playerId: string | undefined,
  playerNameById: Record<string, string>
): string {
  if (!playerId) return 'TBD';
  return playerNameById[playerId] ?? 'TBD';
}

function buildMatchLineup(
  group: TournamentMatchGroup,
  tournament: Tournament,
  playerNameById: Record<string, string>,
  groupHoleResults: Array<
    Pick<TournamentMatchHoleResult, 'hole' | 'hole_winner' | 'pairing_index'>
  >,
  sideAName: string,
  sideBName: string
): RoundMatchLineup {
  const groupFormat = getMatchGroupFormat(group, tournament);

  if (isSinglesFormat(groupFormat)) {
    const pairingCount = Math.max(
      group.side_a_player_ids.length,
      group.side_b_player_ids.length,
      1
    );

    return {
      kind: 'singles',
      pairings: Array.from({ length: pairingCount }, (_, index) => {
        const pairingSummary = buildPairingMatchStatus(
          groupHoleResults,
          index,
          sideAName,
          sideBName
        );

        return {
          pairingIndex: index,
          sideAPlayer: formatPlayerName(group.side_a_player_ids[index], playerNameById),
          sideBPlayer: formatPlayerName(group.side_b_player_ids[index], playerNameById),
          ...pairingSummary,
        };
      }),
    };
  }

  return {
    kind: 'team',
    sideAPlayers: group.side_a_player_ids.map((id) => formatPlayerName(id, playerNameById)),
    sideBPlayers: group.side_b_player_ids.map((id) => formatPlayerName(id, playerNameById)),
  };
}

export function useTournamentRoundMatchSummaries(
  tournament: Tournament | undefined,
  teams: TournamentTeam[],
  matchGroups: TournamentMatchGroup[],
  roundNumber: number,
  playerNameById: Record<string, string> = {},
  scores: TournamentScore[] = [],
  useNetScoring = false
) {
  const roundGroups = useMemo(
    () =>
      [...matchGroups]
        .filter((group) => group.round_number === roundNumber)
        .sort((a, b) => a.tee_time.localeCompare(b.tee_time) || a.group_number - b.group_number),
    [matchGroups, roundNumber]
  );

  const groupIds = useMemo(() => roundGroups.map((group) => group.id), [roundGroups]);

  const { data: holeResults = [], isPending } = useQuery({
    queryKey: ['matchHoleResults', 'round', tournament?.id, roundNumber, groupIds],
    queryFn: () => getMatchHoleResultsForGroups(groupIds, roundNumber),
    enabled: Boolean(tournament?.id) && groupIds.length > 0,
    refetchInterval: 15_000,
  });

  const summaries = useMemo((): RoundMatchSummary[] => {
    const sideAName = getTeamSideDisplayName('side_a', teams);
    const sideBName = getTeamSideDisplayName('side_b', teams);
    const now = new Date();

    return roundGroups.map((group) => {
      const effectiveHoleResults = resolveEffectiveGroupHoleResults(
        group,
        holeResults,
        scores,
        useNetScoring
      );
      const { matchStatus, playStatus } = buildMatchStatusFromHoleResults(
        group,
        holeResults,
        sideAName,
        sideBName,
        { scores, useNetScoring }
      );
      const display = resolveMatchGroupDisplayStatus(
        group,
        playStatus,
        matchStatus,
        effectiveHoleResults.length,
        now
      );

      return {
        group,
        sideAName,
        sideBName,
        lineup: tournament
          ? buildMatchLineup(
              group,
              tournament,
              playerNameById,
              effectiveHoleResults,
              sideAName,
              sideBName
            )
          : { kind: 'team', sideAPlayers: [], sideBPlayers: [] },
        playStatus,
        statusLabel: display.label,
        displayTone: display.tone,
        resultSummary: formatMatchResultSummary(group, matchStatus, sideAName, sideBName),
        matchStatus,
        winnerSide: resolveMatchWinnerSide(group, matchStatus),
      };
    });
  }, [roundGroups, holeResults, teams, tournament, playerNameById, scores, useNetScoring]);

  return { summaries, isLoading: isPending && groupIds.length > 0 };
}
