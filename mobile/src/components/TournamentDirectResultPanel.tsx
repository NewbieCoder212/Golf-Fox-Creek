import { View, Text, Pressable, ScrollView } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { MatchStatusHeader } from '@/components/match-play/MatchStatusHeader';
import { DirectResultToggle } from '@/components/match-play/DirectResultToggle';
import { MatchPlayHoleGrid } from '@/components/match-play/MatchPlayHoleGrid';
import type { MatchStatus } from '@/lib/tournament-match-status';
import { computeLiveMatchStatus } from '@/lib/tournament-match-status';
import { outcomesMapToHoleResultRows } from '@/lib/match-hole-outcomes';
import type { HoleOutcomesMap, PairingOutcomesMap } from '@/lib/match-hole-outcomes';
import type { TournamentFormat, TournamentMatchHoleWinner } from '@/types';
import { FOX_CREEK_DATA } from '@/lib/course-data';
import { cn } from '@/lib/cn';

export interface DirectResultPlayer {
  id: string;
  name: string;
}

interface SinglesPairing {
  pairingIndex: number;
  sideAPlayer: DirectResultPlayer;
  sideBPlayer: DirectResultPlayer;
}

interface TournamentDirectResultPanelProps {
  format: TournamentFormat;
  sideAName: string;
  sideBName: string;
  sideAPlayers: DirectResultPlayer[];
  sideBPlayers: DirectResultPlayer[];
  currentHole: number;
  holeOutcomes: HoleOutcomesMap;
  pairingOutcomes: PairingOutcomesMap;
  activePairingIndex: number;
  singlesPairings: SinglesPairing[];
  onSetCurrentHole: (hole: number) => void;
  onSetActivePairingIndex: (index: number) => void;
  onSetHoleOutcome: (hole: number, winner: TournamentMatchHoleWinner, pairingIndex?: number) => void;
}

function HoleNavigator({
  currentHole,
  onPrev,
  onNext,
}: {
  currentHole: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const par = FOX_CREEK_DATA.holeData.find((h) => h.holeNumber === currentHole)?.par ?? 4;

  return (
    <View className="flex-row items-center justify-between mx-4 my-3">
      <Pressable
        onPress={onPrev}
        disabled={currentHole <= 1}
        className={cn('p-2 rounded-lg bg-neutral-800', currentHole <= 1 && 'opacity-30')}
      >
        <ChevronLeft size={22} color="#a3e635" />
      </Pressable>
      <View className="items-center">
        <Text className="text-white text-xl font-bold">Hole {currentHole}</Text>
        <Text className="text-neutral-500 text-sm">Par {par}</Text>
      </View>
      <Pressable
        onPress={onNext}
        disabled={currentHole >= 18}
        className={cn('p-2 rounded-lg bg-neutral-800', currentHole >= 18 && 'opacity-30')}
      >
        <ChevronRight size={22} color="#a3e635" />
      </Pressable>
    </View>
  );
}

function TeamMatchSection({
  sideAName,
  sideBName,
  sideAPlayers,
  sideBPlayers,
  currentHole,
  outcomes,
  onSetCurrentHole,
  onSetHoleOutcome,
}: {
  sideAName: string;
  sideBName: string;
  sideAPlayers: DirectResultPlayer[];
  sideBPlayers: DirectResultPlayer[];
  currentHole: number;
  outcomes: HoleOutcomesMap;
  onSetCurrentHole: (hole: number) => void;
  onSetHoleOutcome: (hole: number, winner: TournamentMatchHoleWinner) => void;
}) {
  const holeRows = outcomesMapToHoleResultRows(outcomes);
  const matchStatus = computeLiveMatchStatus({
    holeResults: holeRows,
    sideAName,
    sideBName,
  });

  const currentOutcome = outcomes[currentHole] ?? null;
  const locked = matchStatus.clinched && currentHole > matchStatus.throughHole;

  return (
    <>
      <MatchStatusHeader
        matchStatus={matchStatus}
        sideAName={sideAName}
        sideBName={sideBName}
      />
      <HoleNavigator
        currentHole={currentHole}
        onPrev={() => onSetCurrentHole(currentHole - 1)}
        onNext={() => onSetCurrentHole(currentHole + 1)}
      />
      <DirectResultToggle
        sideAName={sideAName}
        sideBName={sideBName}
        sideAPlayers={sideAPlayers}
        sideBPlayers={sideBPlayers}
        currentOutcome={currentOutcome}
        disabled={locked}
        onSelect={(winner) => onSetHoleOutcome(currentHole, winner)}
      />
      <MatchPlayHoleGrid
        outcomes={outcomes}
        currentHole={currentHole}
        matchStatus={matchStatus}
        onSelectHole={onSetCurrentHole}
      />
    </>
  );
}

function SinglesPairingSection({
  pairing,
  sideAName,
  sideBName,
  currentHole,
  outcomes,
  onSetCurrentHole,
  onSetHoleOutcome,
}: {
  pairing: SinglesPairing;
  sideAName: string;
  sideBName: string;
  currentHole: number;
  outcomes: HoleOutcomesMap;
  onSetCurrentHole: (hole: number) => void;
  onSetHoleOutcome: (hole: number, winner: TournamentMatchHoleWinner, pairingIndex: number) => void;
}) {
  const holeRows = outcomesMapToHoleResultRows(outcomes);
  const matchStatus = computeLiveMatchStatus({
    holeResults: holeRows,
    sideAName: pairing.sideAPlayer.name,
    sideBName: pairing.sideBPlayer.name,
  });

  const currentOutcome = outcomes[currentHole] ?? null;
  const locked = matchStatus.clinched && currentHole > matchStatus.throughHole;

  return (
    <View className="mb-6">
      <Text className="text-neutral-400 text-xs uppercase tracking-widest mx-4 mb-2">
        {pairing.sideAPlayer.name} vs {pairing.sideBPlayer.name}
      </Text>
      <MatchStatusHeader
        matchStatus={matchStatus}
        sideAName={pairing.sideAPlayer.name}
        sideBName={pairing.sideBPlayer.name}
        compact
      />
      <DirectResultToggle
        sideAName={sideAName}
        sideBName={sideBName}
        sideAPlayers={[pairing.sideAPlayer]}
        sideBPlayers={[pairing.sideBPlayer]}
        currentOutcome={currentOutcome}
        disabled={locked}
        onSelect={(winner) =>
          onSetHoleOutcome(currentHole, winner, pairing.pairingIndex)
        }
      />
      <MatchPlayHoleGrid
        outcomes={outcomes}
        currentHole={currentHole}
        matchStatus={matchStatus}
        onSelectHole={onSetCurrentHole}
        title={`Match ${pairing.pairingIndex + 1}`}
      />
    </View>
  );
}

export function TournamentDirectResultPanel({
  format,
  sideAName,
  sideBName,
  sideAPlayers,
  sideBPlayers,
  currentHole,
  holeOutcomes,
  pairingOutcomes,
  activePairingIndex,
  singlesPairings,
  onSetCurrentHole,
  onSetActivePairingIndex,
  onSetHoleOutcome,
}: TournamentDirectResultPanelProps) {
  const isSingles = format === 'singles' || format === 'match_play';

  if (!isSingles) {
    return (
      <TeamMatchSection
        sideAName={sideAName}
        sideBName={sideBName}
        sideAPlayers={sideAPlayers}
        sideBPlayers={sideBPlayers}
        currentHole={currentHole}
        outcomes={holeOutcomes}
        onSetCurrentHole={onSetCurrentHole}
        onSetHoleOutcome={onSetHoleOutcome}
      />
    );
  }

  const activePairing = singlesPairings[activePairingIndex] ?? singlesPairings[0];

  return (
    <View>
      {singlesPairings.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mx-4 mb-3"
          contentContainerStyle={{ gap: 8 }}
        >
          {singlesPairings.map((pairing) => (
            <Pressable
              key={pairing.pairingIndex}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSetActivePairingIndex(pairing.pairingIndex);
              }}
              className={cn(
                'px-4 py-2 rounded-lg border',
                activePairingIndex === pairing.pairingIndex
                  ? 'bg-lime-900/30 border-lime-600'
                  : 'bg-neutral-900 border-neutral-700'
              )}
            >
              <Text
                className={cn(
                  'text-xs font-semibold',
                  activePairingIndex === pairing.pairingIndex
                    ? 'text-lime-400'
                    : 'text-neutral-400'
                )}
              >
                {pairing.sideAPlayer.name} vs {pairing.sideBPlayer.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <HoleNavigator
        currentHole={currentHole}
        onPrev={() => onSetCurrentHole(currentHole - 1)}
        onNext={() => onSetCurrentHole(currentHole + 1)}
      />

      {activePairing ? (
        <SinglesPairingSection
          pairing={activePairing}
          sideAName={sideAName}
          sideBName={sideBName}
          currentHole={currentHole}
          outcomes={pairingOutcomes[activePairing.pairingIndex] ?? {}}
          onSetCurrentHole={onSetCurrentHole}
          onSetHoleOutcome={onSetHoleOutcome}
        />
      ) : null}
    </View>
  );
}
