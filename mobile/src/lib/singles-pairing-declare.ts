import type { TournamentMatchHoleResult, TournamentMatchHoleWinner } from '@/types';

type DeclaredPairingWinner = TournamentMatchHoleWinner;

function declaredPairingHoleRow(
  matchGroupId: string,
  roundNumber: number,
  hole: number,
  winner: DeclaredPairingWinner,
  pairingIndex: number
): Omit<TournamentMatchHoleResult, 'id'> {
  return {
    match_group_id: matchGroupId,
    round_number: roundNumber,
    hole,
    side_a_net: 0,
    side_b_net: 0,
    hole_winner: winner,
    pairing_index: pairingIndex,
  };
}

/** Build synthetic complete hole results for an admin-declared singles pairing winner. */
export function buildDeclaredSinglesPairingHoleResults(params: {
  matchGroupId: string;
  roundNumber: number;
  pairingIndex: number;
  winner: DeclaredPairingWinner;
}): Omit<TournamentMatchHoleResult, 'id'>[] {
  const { matchGroupId, roundNumber, pairingIndex, winner } = params;

  if (winner === 'tie') {
    return Array.from({ length: 18 }, (_, index) =>
      declaredPairingHoleRow(matchGroupId, roundNumber, index + 1, 'tie', pairingIndex)
    );
  }

  const winSide = winner;
  const loseSide: DeclaredPairingWinner = winner === 'side_a' ? 'side_b' : 'side_a';
  const rows: Omit<TournamentMatchHoleResult, 'id'>[] = [];

  for (let hole = 1; hole <= 10; hole += 1) {
    rows.push(declaredPairingHoleRow(matchGroupId, roundNumber, hole, winSide, pairingIndex));
  }
  for (let hole = 11; hole <= 18; hole += 1) {
    rows.push(declaredPairingHoleRow(matchGroupId, roundNumber, hole, loseSide, pairingIndex));
  }

  return rows;
}

/** Replace hole results for one pairing index, keeping other pairings unchanged. */
export function mergeSinglesPairingHoleResults(
  existing: TournamentMatchHoleResult[],
  pairingIndex: number,
  newRows: Omit<TournamentMatchHoleResult, 'id'>[]
): Omit<TournamentMatchHoleResult, 'id'>[] {
  const kept = existing
    .filter((row) => (row.pairing_index ?? 0) !== pairingIndex)
    .map((row) => ({
      match_group_id: row.match_group_id,
      round_number: row.round_number,
      hole: row.hole,
      side_a_net: row.side_a_net,
      side_b_net: row.side_b_net,
      hole_winner: row.hole_winner,
      pairing_index: row.pairing_index,
    }));
  return [...kept, ...newRows];
}

/** Remove all hole results for one pairing index. */
export function removeSinglesPairingHoleResults(
  existing: TournamentMatchHoleResult[],
  pairingIndex: number
): Omit<TournamentMatchHoleResult, 'id'>[] {
  return existing
    .filter((row) => (row.pairing_index ?? 0) !== pairingIndex)
    .map((row) => ({
      match_group_id: row.match_group_id,
      round_number: row.round_number,
      hole: row.hole,
      side_a_net: row.side_a_net,
      side_b_net: row.side_b_net,
      hole_winner: row.hole_winner,
      pairing_index: row.pairing_index,
    }));
}
