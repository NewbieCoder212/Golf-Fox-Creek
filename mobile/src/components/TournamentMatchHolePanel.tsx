import { View, Text, Pressable } from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useState, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { TournamentFormat } from '@/types';
import type { HoleOutcome, MatchStatus, RecentHoleOutcomeRow } from '@/lib/tournament-match-status';
import type { TournamentTeamSide } from '@/types';
import { cn } from '@/lib/cn';

export interface MatchPanelPlayer {
  id: string;
  name: string;
  gross: number | null;
  isCounting?: boolean;
}

interface TournamentMatchHolePanelProps {
  currentHole: number;
  currentHolePar: number;
  sideAName: string;
  sideBName: string;
  matchStatus: MatchStatus;
  personalMatchStatus?: MatchStatus | null;
  viewerSide?: TournamentTeamSide;
  format: TournamentFormat;
  isTeamFormat: boolean;
  sideAPlayers: MatchPanelPlayer[];
  sideBPlayers: MatchPanelPlayer[];
  sideATeamGross?: number | null;
  sideBTeamGross?: number | null;
  currentHoleOutcome?: string;
  currentHoleWinner?: 'side_a' | 'side_b' | 'tie' | null;
  recentHoleRows: RecentHoleOutcomeRow[];
  scoringModeLabel?: string;
  entryStatusLabel?: string | null;
  onSetCurrentHole: (hole: number) => void;
  onPlayerScoreAdjust: (side: 'a' | 'b', playerIndex: number, delta: number) => void;
  onTeamScoreAdjust?: (side: 'a' | 'b', delta: number) => void;
}

function outcomeStyle(outcome: HoleOutcome): {
  chipBg: string;
  chipBorder: string;
  label: string;
  labelColor: string;
} {
  switch (outcome) {
    case 'win':
      return {
        chipBg: 'bg-lime-900/40',
        chipBorder: 'border-lime-500',
        label: 'Won',
        labelColor: 'text-lime-300',
      };
    case 'loss':
      return {
        chipBg: 'bg-red-950/40',
        chipBorder: 'border-red-500',
        label: 'Lost',
        labelColor: 'text-red-300',
      };
    case 'halved':
      return {
        chipBg: 'bg-neutral-800/60',
        chipBorder: 'border-neutral-500',
        label: 'Halved',
        labelColor: 'text-neutral-300',
      };
    default:
      return {
        chipBg: 'bg-neutral-900',
        chipBorder: 'border-neutral-700',
        label: '—',
        labelColor: 'text-neutral-600',
      };
  }
}

function MatchHoleHistoryStrip({
  rows,
  currentHole,
  onSelectHole,
}: {
  rows: RecentHoleOutcomeRow[];
  currentHole: number;
  onSelectHole: (hole: number) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <View className="bg-[#141414] rounded-xl border border-neutral-800 px-3 py-3">
      <Text className="text-neutral-400 text-[10px] uppercase tracking-widest text-center mb-0.5">
        Recent holes
      </Text>
      <Text className="text-neutral-600 text-[10px] text-center mb-3">
        Oldest ← → newest · tap to jump
      </Text>

      <View className="flex-row items-end justify-center gap-2">
        {rows.map((row) => {
          const style = outcomeStyle(row.outcome);
          const isCurrent = row.hole === currentHole;
          return (
            <Pressable
              key={row.hole}
              onPress={() => onSelectHole(row.hole)}
              className={cn('items-center min-w-[44px] active:opacity-80', isCurrent && 'opacity-100')}
            >
              <View
                className={cn(
                  'px-2 py-1 rounded-lg border items-center min-w-[44px]',
                  style.chipBg,
                  style.chipBorder,
                  isCurrent && 'border-lime-400'
                )}
              >
                <Text className={cn('text-[10px] font-bold', style.labelColor)}>{style.label}</Text>
              </View>
              <Text
                className={cn(
                  'text-[10px] mt-1 font-medium',
                  isCurrent ? 'text-lime-400' : 'text-neutral-500'
                )}
              >
                #{row.hole}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row items-center justify-center gap-3 mt-3 pt-2 border-t border-neutral-800/80">
        <LegendSwatch outcome="win" />
        <LegendSwatch outcome="halved" />
        <LegendSwatch outcome="loss" />
      </View>
    </View>
  );
}

function LegendSwatch({ outcome }: { outcome: HoleOutcome }) {
  const style = outcomeStyle(outcome);
  return (
    <View className="flex-row items-center gap-1">
      <View className={cn('w-2 h-2 rounded-full border', style.chipBg, style.chipBorder)} />
      <Text className="text-neutral-600 text-[9px]">{style.label}</Text>
    </View>
  );
}

function CurrentHoleResultBanner({
  message,
  result,
}: {
  message: string;
  result: 'won' | 'lost' | 'halved' | 'pending';
}) {
  if (!message) return null;

  return (
    <View
      className={cn(
        'rounded-xl border px-3 py-2.5 mb-3',
        result === 'won' && 'bg-lime-900/20 border-lime-600/60',
        result === 'lost' && 'bg-red-950/20 border-red-800/60',
        result === 'halved' && 'bg-neutral-800/40 border-neutral-600/60',
        result === 'pending' && 'bg-[#141414] border-neutral-800'
      )}
    >
      <Text
        className={cn(
          'text-base font-bold text-center',
          result === 'won' && 'text-lime-300',
          result === 'lost' && 'text-red-300',
          result === 'halved' && 'text-neutral-200',
          result === 'pending' && 'text-neutral-400 text-sm font-semibold'
        )}
      >
        {message}
      </Text>
    </View>
  );
}

function ScoreStepper({
  value,
  par,
  onDecrement,
  onIncrement,
  compact,
}: {
  value: number | null;
  par: number;
  onDecrement: () => void;
  onIncrement: () => void;
  compact?: boolean;
}) {
  const display = value ?? '–';
  const diff = typeof value === 'number' ? value - par : 0;

  return (
    <View className="flex-row items-center justify-center gap-1">
      <Pressable
        onPress={onDecrement}
        className={cn(
          'rounded-full bg-neutral-800 items-center justify-center',
          compact ? 'w-7 h-7' : 'w-8 h-8'
        )}
      >
        <Text className="text-lime-400 text-lg font-bold">−</Text>
      </Pressable>
      <View className="items-center min-w-[32px]">
        <Text
          className={cn(
            'font-bold',
            compact ? 'text-lg' : 'text-xl',
            value === null
              ? 'text-neutral-600'
              : diff < 0
                ? 'text-lime-400'
                : diff === 0
                  ? 'text-white'
                  : 'text-red-400'
          )}
        >
          {display}
        </Text>
      </View>
      <Pressable
        onPress={onIncrement}
        className={cn(
          'rounded-full bg-neutral-800 items-center justify-center',
          compact ? 'w-7 h-7' : 'w-8 h-8'
        )}
      >
        <Text className="text-lime-400 text-lg font-bold">+</Text>
      </Pressable>
    </View>
  );
}

function SideColumn({
  teamName,
  isTeamFormat,
  players,
  teamGross,
  par,
  holeResult = 'pending',
  onPlayerAdjust,
  onTeamAdjust,
}: {
  teamName: string;
  isTeamFormat: boolean;
  players: MatchPanelPlayer[];
  teamGross?: number | null;
  par: number;
  holeResult?: 'won' | 'lost' | 'halved' | 'pending';
  onPlayerAdjust: (playerIndex: number, delta: number) => void;
  onTeamAdjust?: (delta: number) => void;
}) {
  return (
    <View
      className={cn(
        'flex-1 rounded-xl border p-3',
        holeResult === 'won' && 'bg-lime-900/30 border-lime-500',
        holeResult === 'lost' && 'bg-[#141414] border-neutral-800 opacity-80',
        holeResult === 'halved' && 'bg-neutral-800/40 border-neutral-600',
        holeResult === 'pending' && 'bg-[#141414] border-neutral-800'
      )}
    >
      <Text
        className={cn(
          'text-xs font-bold uppercase tracking-wider mb-2 text-center',
          holeResult === 'won' ? 'text-lime-300' : 'text-lime-400'
        )}
      >
        {teamName}
        {holeResult === 'won' ? ' · WON' : holeResult === 'halved' ? ' · HALVED' : ''}
      </Text>

      {isTeamFormat && onTeamAdjust ? (
        <View className="items-center py-2 mb-2 border-b border-neutral-800/60">
          <Text className="text-neutral-500 text-[10px] uppercase mb-1">Team score</Text>
          <ScoreStepper
            value={teamGross ?? par}
            par={par}
            onDecrement={() => onTeamAdjust(-1)}
            onIncrement={() => onTeamAdjust(1)}
          />
        </View>
      ) : null}

      {players.map((player, index) => (
        <View
          key={player.id}
          className={cn(
            'py-2',
            index < players.length - 1 && 'border-b border-neutral-800/40',
            player.isCounting && 'bg-lime-900/15 -mx-1 px-1 rounded-lg'
          )}
        >
          <Text className="text-white text-xs font-medium mb-1 text-center" numberOfLines={1}>
            {player.name.split(' ')[0]}
            {player.isCounting ? ' ★' : ''}
          </Text>
          {!isTeamFormat ? (
            <ScoreStepper
              value={player.gross}
              par={par}
              compact
              onDecrement={() => onPlayerAdjust(index, -1)}
              onIncrement={() => onPlayerAdjust(index, 1)}
            />
          ) : (
            <Text className="text-neutral-400 text-sm text-center">{player.gross ?? '–'}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

export function TournamentMatchHolePanel({
  currentHole,
  currentHolePar,
  sideAName,
  sideBName,
  matchStatus,
  personalMatchStatus,
  viewerSide = 'side_a',
  format,
  isTeamFormat,
  sideAPlayers,
  sideBPlayers,
  sideATeamGross,
  sideBTeamGross,
  currentHoleOutcome,
  currentHoleWinner,
  recentHoleRows,
  scoringModeLabel,
  entryStatusLabel,
  onSetCurrentHole,
  onPlayerScoreAdjust,
  onTeamScoreAdjust,
}: TournamentMatchHolePanelProps) {
  const [expanded, setExpanded] = useState(true);

  const statusHeadline = useMemo(() => {
    if (matchStatus.throughHole === 0) {
      return 'ALL SQUARE';
    }
    if (matchStatus.clinched) {
      return matchStatus.label;
    }
    const standing = matchStatus.lead === 0 ? 'ALL SQUARE' : matchStatus.label;
    return `${standing} · thru ${matchStatus.throughHole}`;
  }, [matchStatus]);

  const sideAHoleResult = useMemo((): 'won' | 'lost' | 'halved' | 'pending' => {
    if (!currentHoleWinner) return 'pending';
    if (currentHoleWinner === 'tie') return 'halved';
    return currentHoleWinner === 'side_a' ? 'won' : 'lost';
  }, [currentHoleWinner]);

  const sideBHoleResult = useMemo((): 'won' | 'lost' | 'halved' | 'pending' => {
    if (!currentHoleWinner) return 'pending';
    if (currentHoleWinner === 'tie') return 'halved';
    return currentHoleWinner === 'side_b' ? 'won' : 'lost';
  }, [currentHoleWinner]);

  const viewerHoleResult = useMemo((): 'won' | 'lost' | 'halved' | 'pending' => {
    if (!currentHoleWinner) return 'pending';
    if (currentHoleWinner === 'tie') return 'halved';
    const yourSide = viewerSide ?? 'side_a';
    if (currentHoleWinner === yourSide) return 'won';
    return 'lost';
  }, [currentHoleWinner, viewerSide]);

  const currentHoleBannerText = useMemo(() => {
    if (!currentHoleOutcome) {
      return viewerHoleResult === 'pending'
        ? 'Enter scores for both teams to decide this hole'
        : '';
    }
    return currentHoleOutcome;
  }, [currentHoleOutcome, viewerHoleResult]);

  return (
    <View className="bg-[#1a1a1a] border-b border-neutral-800">
      <Pressable
        onPress={() => setExpanded(!expanded)}
        className="px-5 py-3 flex-row items-center justify-between active:opacity-80"
      >
        <View className="flex-1">
          <Text className="text-lime-400 text-lg font-bold tracking-wide">{statusHeadline}</Text>
          <Text className="text-neutral-500 text-xs mt-0.5">
            {matchStatus.throughHole > 0
              ? `Standing after hole ${matchStatus.throughHole} · ${matchStatus.holesRemaining} left`
              : entryStatusLabel ?? 'No holes decided yet'}
          </Text>
          {personalMatchStatus ? (
            <Text className="text-neutral-400 text-xs mt-1">
              Your match: {personalMatchStatus.throughHole > 0 ? personalMatchStatus.label : 'AS'}
            </Text>
          ) : null}
        </View>
        {expanded ? (
          <ChevronUp size={18} color="#737373" />
        ) : (
          <ChevronDown size={18} color="#737373" />
        )}
      </Pressable>

      {expanded ? (
        <Animated.View entering={FadeInDown.duration(200)} className="px-5 pb-4">
          <View className="flex-row items-center justify-between mb-3 bg-[#141414] rounded-xl border border-neutral-800 px-3 py-2">
            <Pressable
              onPress={() => currentHole > 1 && onSetCurrentHole(currentHole - 1)}
              disabled={currentHole === 1}
              className="p-2"
            >
              <ChevronLeft size={22} color={currentHole === 1 ? '#404040' : '#a3e635'} />
            </Pressable>
            <View className="items-center">
              <Text className="text-neutral-500 text-[10px] uppercase tracking-widest">
                Hole {currentHole}
              </Text>
              <Text className="text-white text-xl font-bold">Par {currentHolePar}</Text>
              <Text className="text-neutral-600 text-[10px] capitalize">{format.replace('_', ' ')}</Text>
              {scoringModeLabel ? (
                <Text className="text-neutral-600 text-[9px] mt-0.5">{scoringModeLabel}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => currentHole < 18 && onSetCurrentHole(currentHole + 1)}
              disabled={currentHole === 18}
              className="p-2"
            >
              <ChevronRight size={22} color={currentHole === 18 ? '#404040' : '#a3e635'} />
            </Pressable>
          </View>

          <View className="flex-row gap-2 mb-3">
            <SideColumn
              teamName={sideAName}
              isTeamFormat={isTeamFormat}
              players={sideAPlayers}
              teamGross={sideATeamGross}
              par={currentHolePar}
              holeResult={sideAHoleResult}
              onPlayerAdjust={(index, delta) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPlayerScoreAdjust('a', index, delta);
              }}
              onTeamAdjust={
                onTeamScoreAdjust
                  ? (delta) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onTeamScoreAdjust('a', delta);
                    }
                  : undefined
              }
            />
            <SideColumn
              teamName={sideBName}
              isTeamFormat={isTeamFormat}
              players={sideBPlayers}
              teamGross={sideBTeamGross}
              par={currentHolePar}
              holeResult={sideBHoleResult}
              onPlayerAdjust={(index, delta) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPlayerScoreAdjust('b', index, delta);
              }}
              onTeamAdjust={
                onTeamScoreAdjust
                  ? (delta) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onTeamScoreAdjust('b', delta);
                    }
                  : undefined
              }
            />
          </View>

          <CurrentHoleResultBanner message={currentHoleBannerText} result={viewerHoleResult} />

          <MatchHoleHistoryStrip
            rows={recentHoleRows}
            currentHole={currentHole}
            onSelectHole={onSetCurrentHole}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
