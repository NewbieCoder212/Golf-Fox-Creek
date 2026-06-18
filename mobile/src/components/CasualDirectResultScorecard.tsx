import { View } from 'react-native';

import { MatchStatusHeader } from '@/components/match-play/MatchStatusHeader';
import { DirectResultToggle } from '@/components/match-play/DirectResultToggle';
import { MatchPlayHoleGrid } from '@/components/match-play/MatchPlayHoleGrid';
import { computeLiveMatchStatus } from '@/lib/tournament-match-status';
import { outcomesMapToHoleResultRows } from '@/lib/match-hole-outcomes';
import type { TournamentMatchHoleWinner } from '@/types';
import type { HoleOutcomesMap } from '@/lib/match-hole-outcomes';

interface CasualPlayer {
  id: number;
  name: string;
}

interface CasualDirectResultScorecardProps {
  players: CasualPlayer[];
  currentHole: number;
  holeOutcomes: HoleOutcomesMap;
  onSetCurrentHole: (hole: number) => void;
  onSetOutcome: (hole: number, winner: TournamentMatchHoleWinner) => void;
}

function resolveSides(players: CasualPlayer[]): {
  sideAName: string;
  sideBName: string;
  sideAPlayers: { id: string; name: string }[];
  sideBPlayers: { id: string; name: string }[];
} {
  if (players.length >= 4) {
    const sideAPlayers = players.slice(0, 2);
    const sideBPlayers = players.slice(2, 4);
    return {
      sideAName: sideAPlayers.map((p) => p.name).join(' & '),
      sideBName: sideBPlayers.map((p) => p.name).join(' & '),
      sideAPlayers: sideAPlayers.map((p) => ({ id: String(p.id), name: p.name })),
      sideBPlayers: sideBPlayers.map((p) => ({ id: String(p.id), name: p.name })),
    };
  }

  return {
    sideAName: players[0]?.name ?? 'Player 1',
    sideBName: players[1]?.name ?? 'Player 2',
    sideAPlayers: players[0] ? [{ id: String(players[0].id), name: players[0].name }] : [],
    sideBPlayers: players[1] ? [{ id: String(players[1].id), name: players[1].name }] : [],
  };
}

export function CasualDirectResultScorecard({
  players,
  currentHole,
  holeOutcomes,
  onSetCurrentHole,
  onSetOutcome,
}: CasualDirectResultScorecardProps) {
  const { sideAName, sideBName, sideAPlayers, sideBPlayers } = resolveSides(players);
  const holeRows = outcomesMapToHoleResultRows(holeOutcomes);
  const matchStatus = computeLiveMatchStatus({
    holeResults: holeRows,
    sideAName,
    sideBName,
  });

  return (
    <View className="mt-2">
      <MatchStatusHeader matchStatus={matchStatus} sideAName={sideAName} sideBName={sideBName} />
      <DirectResultToggle
        sideAName={sideAName}
        sideBName={sideBName}
        sideAPlayers={sideAPlayers}
        sideBPlayers={sideBPlayers}
        currentOutcome={holeOutcomes[currentHole] ?? null}
        disabled={matchStatus.clinched && currentHole > matchStatus.throughHole}
        onSelect={(winner) => onSetOutcome(currentHole, winner)}
      />
      <MatchPlayHoleGrid
        outcomes={holeOutcomes}
        currentHole={currentHole}
        matchStatus={matchStatus}
        onSelectHole={onSetCurrentHole}
        title="Match Card"
      />
    </View>
  );
}
