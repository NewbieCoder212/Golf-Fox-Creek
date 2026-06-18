import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  holeResultsToOutcomes,
  outcomesMapToHoleResultRows,
} from '@/lib/match-hole-outcomes';
import { getMatchHoleResults } from '@/lib/tournament-match-service';
import { isMatchPlayComplete } from '@/lib/tournament-match-play-status';
import {
  computeLiveMatchStatus,
  type MatchStatus,
} from '@/lib/tournament-match-status';
import { getMatchGroupFormat, isSinglesFormat } from '@/lib/tournament-labels';
import type {
  Tournament,
  TournamentMatchGroup,
  TournamentTeamSide,
} from '@/types';

export { isMatchPlayComplete } from '@/lib/tournament-match-play-status';

function getViewerPairingIndex(
  group: TournamentMatchGroup,
  viewerSide: TournamentTeamSide,
  rosterPlayerIds: string[]
): number {
  const mySideIds =
    viewerSide === 'side_a' ? group.side_a_player_ids : group.side_b_player_ids;
  const myId = mySideIds.find((id) => rosterPlayerIds.includes(id));
  if (!myId) return 0;
  const index = mySideIds.indexOf(myId);
  return index >= 0 ? index : 0;
}

export function getMatchCompletionDetail(
  status: MatchStatus,
  viewerSide: TournamentTeamSide,
  mySideName: string,
  oppSideName: string,
  group?: Pick<TournamentMatchGroup, 'match_winner'> | null
): string {
  if (status.lead === 0) {
    if (group?.match_winner === 'tie') {
      return 'Match halved — each team earns half a point.';
    }
    if (group?.match_winner === 'side_a') {
      return `${mySideName} won this match.`;
    }
    if (group?.match_winner === 'side_b') {
      return `${oppSideName} won this match.`;
    }
    return 'Match halved — each team earns half a point.';
  }

  const viewerWon =
    (viewerSide === 'side_a' && status.lead > 0) ||
    (viewerSide === 'side_b' && status.lead < 0);

  if (viewerWon) {
    return `${mySideName} won this match.`;
  }

  return `${oppSideName} won this match.`;
}

export function useMyMatchTabStatus(params: {
  tournament: Tournament;
  group: TournamentMatchGroup | null;
  roundNumber: number;
  viewerSide: TournamentTeamSide | null;
  rosterPlayerIds: string[];
  sideAName: string;
  sideBName: string;
  playerNameById: Record<string, string>;
}) {
  const groupId = params.group?.id;

  const { data: holeResults = [], isPending } = useQuery({
    queryKey: ['matchHoleResults', groupId, params.roundNumber],
    queryFn: () => getMatchHoleResults(groupId!, params.roundNumber),
    enabled: Boolean(groupId),
    refetchInterval: 15_000,
  });

  const matchStatus = useMemo(() => {
    if (!params.group || !params.viewerSide) {
      return computeLiveMatchStatus({ holeResults: [] });
    }

    const format = getMatchGroupFormat(params.group, params.tournament);
    const pairingIndex = isSinglesFormat(format)
      ? getViewerPairingIndex(params.group, params.viewerSide, params.rosterPlayerIds)
      : undefined;

    const outcomes = holeResultsToOutcomes(holeResults, pairingIndex);
    const rows = outcomesMapToHoleResultRows(outcomes);

    if (isSinglesFormat(format)) {
      const playerAId = params.group.side_a_player_ids[pairingIndex ?? 0];
      const playerBId = params.group.side_b_player_ids[pairingIndex ?? 0];
      return computeLiveMatchStatus({
        holeResults: rows,
        perspectiveSide: params.viewerSide,
        sideAName: params.playerNameById[playerAId] ?? params.sideAName,
        sideBName: params.playerNameById[playerBId] ?? params.sideBName,
      });
    }

    return computeLiveMatchStatus({
      holeResults: rows,
      perspectiveSide: params.viewerSide,
      sideAName: params.sideAName,
      sideBName: params.sideBName,
    });
  }, [
    params.group,
    params.viewerSide,
    params.tournament,
    params.rosterPlayerIds,
    params.sideAName,
    params.sideBName,
    params.playerNameById,
    holeResults,
  ]);

  const isComplete = isMatchPlayComplete(matchStatus, params.group);

  return { matchStatus, isComplete, isLoading: isPending };
}
