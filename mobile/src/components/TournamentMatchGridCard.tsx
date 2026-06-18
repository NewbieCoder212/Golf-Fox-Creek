import { View, Text, ScrollView } from 'react-native';

import type { MatchGridCell, MatchGridModel, MatchGridRow } from '@/lib/tournament-match-grid';
import { TOURNAMENT_MATCH_HOLES } from '@/lib/tournament-match-scoring';
import { getHoleWinnerBgClass } from '@/lib/match-play-theme';
import { cn } from '@/lib/cn';

const GRID_SIZES = {
  default: { labelWidth: 108, holeWidth: 34, rowHeight: 28 },
  tv: { labelWidth: 140, holeWidth: 44, rowHeight: 36 },
  'tv-compact': { labelWidth: 72, holeWidth: 26, rowHeight: 22 },
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
  sizes: (typeof GRID_SIZES)['default'];
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
  const hasPoints = model.matchPointsA > 0 || model.matchPointsB > 0;
  const gridWidth = TOURNAMENT_MATCH_HOLES.length * sizes.holeWidth;
  const showLive = highlight || model.inProgress;

  return (
    <View
      className={cn(
        'bg-[#141414] rounded-xl border overflow-hidden',
        fillHeight && 'flex-1',
        !fillHeight && 'mb-4',
        showLive ? 'border-lime-500/60 border-2' : 'border-neutral-800'
      )}
    >
      <View className={cn('border-b border-neutral-800', isCompact ? 'px-2 py-1.5' : 'px-4 py-3')}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-2">
            <Text
              className={cn(
                'text-white font-semibold',
                variant === 'tv' ? 'text-lg' : isCompact ? 'text-xs' : 'text-sm'
              )}
              numberOfLines={1}
            >
              Tee {model.teeTimeLabel} · {model.sideAName} vs {model.sideBName}
            </Text>
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
            {model.inProgress && model.throughHole > 0 && !isCompact ? (
              <Text
                className={cn(
                  'text-neutral-500 mt-0.5',
                  variant === 'tv' ? 'text-xs' : 'text-[10px]'
                )}
              >
                Through hole {model.throughHole}
              </Text>
            ) : null}
          </View>
          {showLive ? (
            <View className="flex-row items-center bg-lime-950/50 border border-lime-600/40 rounded-full px-2 py-0.5">
              <View className="w-1.5 h-1.5 rounded-full bg-lime-400 mr-1" />
              <Text className="text-lime-400 text-[9px] font-bold uppercase tracking-wider">
                Live
              </Text>
            </View>
          ) : null}
        </View>
      </View>

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
    </View>
  );
}
