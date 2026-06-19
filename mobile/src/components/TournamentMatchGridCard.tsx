import { View, Text, ScrollView } from 'react-native';

import type { MatchGridCell, MatchGridModel, MatchGridRow } from '@/lib/tournament-match-grid';
import { TOURNAMENT_MATCH_HOLES } from '@/lib/tournament-match-scoring';
import { getHoleWinnerBgClass, SIDE_A_COLOR, SIDE_B_COLOR } from '@/lib/match-play-theme';
import {
  ColoredMatchResultText,
  ColoredMatchStatusText,
} from '@/components/match-play/ColoredMatchStatusText';
import { cn } from '@/lib/cn';

const GRID_SIZES = {
  default: { labelWidth: 108, holeWidth: 34, rowHeight: 28 },
  tv: { labelWidth: 140, holeWidth: 44, rowHeight: 36 },
  'tv-compact': { labelWidth: 72, holeWidth: 26, rowHeight: 22 },
  'tv-lounge': { labelWidth: 0, holeWidth: 0, rowHeight: 0 },
} as const;

export type MatchGridCardVariant = keyof typeof GRID_SIZES;

function GridCell({
  cell,
  isStatusRow,
  holeWidth,
  rowHeight,
  variant,
}: {
  cell: MatchGridCell;
  isStatusRow: boolean;
  holeWidth: number;
  rowHeight: number;
  variant: MatchGridCardVariant;
}) {
  const outcomeBg =
    cell.holeWinner != null && !isStatusRow
      ? getHoleWinnerBgClass(cell.holeWinner)
      : cell.isWinner
        ? 'bg-red-600'
        : cell.isHalved
          ? 'bg-neutral-600'
          : '';

  return (
    <View
      style={{ width: holeWidth, height: rowHeight }}
      className={cn(
        'items-center justify-center border-r border-neutral-800/60',
        outcomeBg,
        !cell.isPlayed && !isStatusRow && 'opacity-40'
      )}
    >
      <Text
        className={cn(
          'font-semibold',
          variant === 'tv' ? 'text-sm' : variant === 'tv-compact' ? 'text-[9px]' : 'text-[10px]',
          cell.isWinner ? 'text-lime-300' : isStatusRow ? 'text-lime-400' : 'text-neutral-200'
        )}
        numberOfLines={1}
      >
        {cell.display || (isStatusRow ? '' : '–')}
      </Text>
    </View>
  );
}

function LabelCell({
  label,
  isStatusRow,
  labelWidth,
  rowHeight,
  variant,
}: {
  label: string;
  isStatusRow: boolean;
  labelWidth: number;
  rowHeight: number;
  variant: MatchGridCardVariant;
}) {
  return (
    <View
      style={{ width: labelWidth, height: rowHeight }}
      className={cn(
        'justify-center px-2 border-r border-b border-neutral-800 bg-[#101010]',
        isStatusRow && 'bg-lime-950/20'
      )}
    >
      <Text
        className={cn(
          'font-medium',
          variant === 'tv' ? 'text-xs' : variant === 'tv-compact' ? 'text-[9px]' : 'text-[10px]',
          isStatusRow ? 'text-lime-500 uppercase tracking-wider' : 'text-neutral-400'
        )}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

function MatchGridRowView({
  row,
  sizes,
  variant,
}: {
  row: MatchGridRow;
  sizes: (typeof GRID_SIZES)[MatchGridCardVariant];
  variant: MatchGridCardVariant;
}) {
  const isStatusRow = row.kind === 'status';

  return (
    <View className="flex-row">
      <LabelCell
        label={row.label}
        isStatusRow={isStatusRow}
        labelWidth={sizes.labelWidth}
        rowHeight={sizes.rowHeight}
        variant={variant}
      />
      {row.cells.map((cell) => (
        <GridCell
          key={`${row.id}-${cell.hole}`}
          cell={cell}
          isStatusRow={isStatusRow}
          holeWidth={sizes.holeWidth}
          rowHeight={sizes.rowHeight}
          variant={variant}
        />
      ))}
    </View>
  );
}

export function TournamentMatchGridCard({
  model,
  variant = 'default',
  highlight = false,
  fillHeight = false,
}: {
  model: MatchGridModel;
  variant?: MatchGridCardVariant;
  highlight?: boolean;
  fillHeight?: boolean;
}) {
  const sizes = GRID_SIZES[variant];
  const isCompact = variant === 'tv-compact';
  const isLounge = variant === 'tv-lounge';
  const hasPoints = model.matchPointsA > 0 || model.matchPointsB > 0;
  const gridWidth = TOURNAMENT_MATCH_HOLES.length * sizes.holeWidth;
  const showLive = highlight || model.inProgress;
  const isComplete = model.playStatus === 'complete';
  const isScheduled = model.playStatus === 'not_started';

  return (
    <View
      className={cn(
        'bg-[#141414] rounded-xl border overflow-hidden',
        fillHeight && !isLounge && 'flex-1',
        !fillHeight && !isLounge && 'mb-4',
        showLive ? 'border-lime-500/60 border-2' : 'border-neutral-800'
      )}
    >
      <View
        className={cn(
          'border-b border-neutral-800',
          isLounge ? 'px-5 py-4' : isCompact ? 'px-2 py-1.5' : 'px-4 py-3',
          isLounge && !showLive && 'border-b-0'
        )}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-2">
            {isLounge ? (
              <View>
                <Text className="text-neutral-400 text-lg font-semibold">
                  Tee {model.teeTimeLabel}
                </Text>
                <Text className="text-3xl font-bold mt-1 leading-9" numberOfLines={2}>
                  <Text style={{ color: SIDE_A_COLOR }}>{model.sideAName}</Text>
                  <Text className="text-neutral-500"> vs </Text>
                  <Text style={{ color: SIDE_B_COLOR }}>{model.sideBName}</Text>
                </Text>
              </View>
            ) : isCompact ? (
              <View>
                <Text className="text-neutral-500 text-[10px] font-medium">
                  Tee {model.teeTimeLabel}
                </Text>
                <Text className="text-sm font-semibold mt-0.5 leading-5" numberOfLines={2}>
                  <Text style={{ color: SIDE_A_COLOR }}>{model.sideAName}</Text>
                  <Text className="text-neutral-500"> vs </Text>
                  <Text style={{ color: SIDE_B_COLOR }}>{model.sideBName}</Text>
                </Text>
              </View>
            ) : (
              <Text
                className={cn(
                  'text-white font-semibold',
                  variant === 'tv' ? 'text-lg' : 'text-sm'
                )}
                numberOfLines={1}
              >
                Tee {model.teeTimeLabel} · {model.sideAName} vs {model.sideBName}
              </Text>
            )}
            {hasPoints && !isCompact ? (
              <Text
                className={cn(
                  'text-lime-400 font-semibold mt-1',
                  variant === 'tv' ? 'text-sm' : 'text-xs'
                )}
              >
                Match pts {model.matchPointsA}–{model.matchPointsB}
              </Text>
            ) : null}
            {model.resultSummary ? (
              isComplete ? (
                <ColoredMatchResultText
                  summary={model.resultSummary}
                  sideAName={model.sideAName}
                  sideBName={model.sideBName}
                  compact={isCompact}
                  lounge={isLounge}
                />
              ) : model.inProgress && model.matchStatus.throughHole > 0 ? (
                <ColoredMatchStatusText
                  matchStatus={model.matchStatus}
                  sideAName={model.sideAName}
                  sideBName={model.sideBName}
                  compact={isCompact}
                  lounge={isLounge}
                />
              ) : (
                <Text
                  className={cn(
                    'font-semibold mt-0.5',
                    isComplete ? 'text-neutral-200' : 'text-neutral-400',
                    isLounge ? 'text-xl' : variant === 'tv' ? 'text-sm' : isCompact ? 'text-[10px]' : 'text-xs'
                  )}
                  numberOfLines={2}
                >
                  {model.resultSummary}
                </Text>
              )
            ) : model.inProgress && model.matchStatus.throughHole > 0 ? (
              <ColoredMatchStatusText
                matchStatus={model.matchStatus}
                sideAName={model.sideAName}
                sideBName={model.sideBName}
                compact={isCompact}
                lounge={isLounge}
              />
            ) : null}
          </View>
          {showLive ? (
            <View
              className={cn(
                'flex-row items-center bg-lime-950/50 border border-lime-600/40 rounded-full',
                isLounge ? 'px-3 py-1' : 'px-2 py-0.5'
              )}
            >
              <View className={cn('rounded-full bg-lime-400 mr-1', isLounge ? 'w-2 h-2' : 'w-1.5 h-1.5')} />
              <Text
                className={cn(
                  'text-lime-400 font-bold uppercase tracking-wider',
                  isLounge ? 'text-sm' : 'text-[9px]'
                )}
              >
                Live
              </Text>
            </View>
          ) : isComplete ? (
            <View className="rounded-full px-2 py-0.5 border bg-neutral-900 border-neutral-700">
              <Text className="text-neutral-300 text-[9px] font-bold uppercase tracking-wider">
                {model.statusLabel}
              </Text>
            </View>
          ) : isScheduled ? (
            <View className="rounded-full px-2 py-0.5 border bg-neutral-900 border-neutral-700">
              <Text className="text-neutral-500 text-[9px] font-bold uppercase tracking-wider">
                {model.statusLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {!isLounge ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: sizes.labelWidth + gridWidth }}>
          <View className="flex-row border-b border-neutral-800 bg-[#101010]">
            <View
              style={{ width: sizes.labelWidth, height: sizes.rowHeight }}
              className="justify-center px-2 border-r border-neutral-800"
            >
              <Text
                className={cn(
                  'text-neutral-600 uppercase tracking-wider',
                  variant === 'tv' ? 'text-[11px]' : 'text-[9px]'
                )}
              >
                Hole
              </Text>
            </View>
            {TOURNAMENT_MATCH_HOLES.map((hole) => (
              <View
                key={`hole-${hole}`}
                style={{ width: sizes.holeWidth, height: sizes.rowHeight }}
                className="items-center justify-center border-r border-neutral-800/60"
              >
                <Text
                  className={cn(
                    'text-neutral-500 font-bold',
                    variant === 'tv' ? 'text-xs' : 'text-[10px]'
                  )}
                >
                  {hole}
                </Text>
              </View>
            ))}
          </View>

          {model.rows.map((row) => (
            <MatchGridRowView key={row.id} row={row} sizes={sizes} variant={variant} />
          ))}
        </View>
      </ScrollView>
      ) : null}
    </View>
  );
}
