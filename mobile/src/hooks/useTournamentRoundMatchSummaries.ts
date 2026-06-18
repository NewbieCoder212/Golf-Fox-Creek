import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  buildMatchStatusFromHoleResults,
  formatMatchResultSummary,
  type MatchPlayStatus,
} from '@/lib/tournament-match-play-status';
import { getMatchHoleResultsForGroups } from '@/lib/tournament-match-service';
import { getMatchGroupFormat, getTeamSideDisplayName, isSinglesFormat } from '@/lib/tournament-labels';
import type { Tournament, TournamentMatchGroup, TournamentTeam } from '@/types';

export type RoundMatchSinglesPairing = {
  sideAPlayer: string;
  sideBPlayer: string;
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
  resultSummary: string | null;
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
  playerNameById: Record<string, string>
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
      pairings: Array.from({ length: pairingCount }, (_, index) => ({
        sideAPlayer: formatPlayerName(group.side_a_player_ids[index], playerNameById),
        sideBPlayer: formatPlayerName(group.side_b_player_ids[index], playerNameById),
      })),
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
  playerNameById: Record<string, string> = {}
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
    queryKey: ['matchHoleResults', 'round', tournament?.id, roundNumber, groupIds.join(',')],
    queryFn: () => getMatchHoleResultsForGroups(groupIds, roundNumber),
    enabled: Boolean(tournament?.id) && groupIds.length > 0,
    refetchInterval: 15_000,
  });

  const summaries = useMemo((): RoundMatchSummary[] => {
    const sideAName = getTeamSideDisplayName('side_a', teams);
    const sideBName = getTeamSideDisplayName('side_b', teams);

    return roundGroups.map((group) => {
      const { matchStatus, playStatus } = buildMatchStatusFromHoleResults(
        group,
        holeResults,
        sideAName,
        sideBName
      );

      return {
        group,
        sideAName,
        sideBName,
        lineup: tournament
          ? buildMatchLineup(group, tournament, playerNameById)
          : { kind: 'team', sideAPlayers: [], sideBPlayers: [] },
        playStatus,
        statusLabel:
          playStatus === 'complete'
            ? 'Match complete'
            : playStatus === 'in_progress'
              ? 'In progress'
              : 'Scheduled',
        resultSummary: formatMatchResultSummary(group, matchStatus, sideAName, sideBName),
      };
    });
  }, [roundGroups, holeResults, teams, tournament, playerNameById]);

  return { summaries, isLoading: isPending && groupIds.length > 0 };
}
