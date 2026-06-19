import { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';

import {
  buildTournamentTeeSheetRows,
  type TeeSheetDisplayStatus,
  type TournamentTeeSheetRow,
} from '@/lib/tournament-tee-sheet';
import { formatLabel, formatRoundPickerLabel } from '@/lib/tournament-labels';
import { formatClubTime } from '@/lib/club-timezone';
import { cn } from '@/lib/cn';
import type {
  Tournament,
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentTeam,
} from '@/types';

const ROWS_PER_PAGE = 5;
const PAGE_INTERVAL_MS = 12_000;
const CLOCK_TICK_MS = 30_000;

interface TournamentTvTeeSheetProps {
  tournament: Tournament;
  teams: TournamentTeam[];
  matchGroups: TournamentMatchGroup[];
  holeResults: TournamentMatchHoleResult[];
  playerNameById: Record<string, string>;
  roundNumber: number;
  isPreviewingNextRound?: boolean;
  compact?: boolean;
  className?: string;
}

function StatusPill({ status }: { status: TeeSheetDisplayStatus }) {
  return (
    <View
      className={cn(
        'rounded-full px-2 py-0.5 border shrink-0',
        status === 'live' && 'bg-lime-950/50 border-lime-600/50',
        status === 'on_course' && 'bg-amber-950/40 border-amber-600/50',
        status === 'upcoming' && 'bg-neutral-900 border-neutral-700',
        status === 'complete' && 'bg-neutral-900/80 border-neutral-800'
      )}
    >
      <Text
        className={cn(
          'text-[9px] font-bold uppercase tracking-wider',
          status === 'live' && 'text-lime-400',
          status === 'on_course' && 'text-amber-300',
          status === 'upcoming' && 'text-neutral-500',
          status === 'complete' && 'text-neutral-600'
        )}
      >
        {status === 'live' ? 'Live' : status === 'on_course' ? 'On course' : status === 'complete' ? 'Final' : 'Up next'}
      </Text>
    </View>
  );
}

function TeeSheetRow({ row, compact }: { row: TournamentTeeSheetRow; compact?: boolean }) {
  const isHighlighted = row.displayStatus === 'live' || row.displayStatus === 'on_course';

  return (
    <View
      className={cn(
        'rounded-lg border px-2.5 py-2',
        isHighlighted ? 'border-lime-700/40 bg-lime-950/20' : 'border-neutral-800 bg-[#0a0a0a]',
        row.displayStatus === 'complete' && 'opacity-60'
      )}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 min-w-0">
          <Text className="text-white text-xs font-bold" numberOfLines={1}>
            {row.teeTimeLabel}
            <Text className="text-neutral-500 font-semibold"> · G{row.groupNumber}</Text>
          </Text>
          <Text className="text-lime-400/90 text-[10px] font-semibold mt-0.5" numberOfLines={1}>
            {row.sideAName} vs {row.sideBName}
          </Text>
          {!compact ? (
            <Text className="text-neutral-500 text-[10px] mt-0.5" numberOfLines={2}>
              {row.playersLabel}
            </Text>
          ) : null}
          {row.resultSummary ? (
            <Text
              className={cn(
                'text-[10px] mt-0.5 font-semibold',
                row.displayStatus === 'live' ? 'text-lime-300' : 'text-neutral-400'
              )}
              numberOfLines={1}
            >
              {row.resultSummary}
            </Text>
          ) : null}
        </View>
        <StatusPill status={row.displayStatus} />
      </View>
    </View>
  );
}

export function TournamentTvTeeSheet({
  tournament,
  teams,
  matchGroups,
  holeResults,
  playerNameById,
  roundNumber,
  isPreviewingNextRound = false,
  compact = false,
  className,
}: TournamentTvTeeSheetProps) {
  const [now, setNow] = useState(() => new Date());
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const rows = useMemo(
    () =>
      buildTournamentTeeSheetRows({
        tournament,
        teams,
        matchGroups,
        holeResults,
        playerNameById,
        roundNumber,
        now,
      }),
    [tournament, teams, matchGroups, holeResults, playerNameById, roundNumber, now]
  );

  const pages = useMemo(() => {
    if (rows.length <= ROWS_PER_PAGE) return [rows];
    const result: TournamentTeeSheetRow[][] = [];
    for (let index = 0; index < rows.length; index += ROWS_PER_PAGE) {
      result.push(rows.slice(index, index + ROWS_PER_PAGE));
    }
    return result;
  }, [rows]);

  useEffect(() => {
    if (pages.length <= 1) return;
    const timer = setInterval(() => {
      setPageIndex((current) => (current + 1) % pages.length);
    }, PAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pages.length]);

  useEffect(() => {
    setPageIndex(0);
  }, [roundNumber, rows.length]);

  if (rows.length === 0) return null;

  const visibleRows = pages[pageIndex] ?? rows;
  const roundFormat = tournament.round_schedule[roundNumber - 1]?.formats[0];
  const formatName = roundFormat ? formatLabel(roundFormat) : null;
  const roundLabel = formatRoundPickerLabel(tournament, roundNumber);
  const clubClockLabel = formatClubTime(now.toISOString(), true);

  return (
    <View className={cn('rounded-xl border border-neutral-800 bg-[#111111] overflow-hidden relative z-30', className)}>
      <View className="px-3 py-2 border-b border-neutral-800 flex-row items-center justify-between">
        <View className="flex-1 min-w-0 mr-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-neutral-400 text-[10px] font-semibold uppercase tracking-widest">
              {isPreviewingNextRound ? 'Up next' : 'Tee sheet'}
            </Text>
            {isPreviewingNextRound ? (
              <View className="rounded-full px-2 py-0.5 border bg-lime-950/40 border-lime-700/40">
                <Text className="text-lime-400 text-[8px] font-bold uppercase tracking-wider">
                  Preview
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="text-lime-400/90 text-[10px] font-semibold mt-0.5" numberOfLines={1}>
            {roundLabel}
          </Text>
          <Text className="text-neutral-600 text-[10px] mt-0.5">Now {clubClockLabel}</Text>
        </View>
        {pages.length > 1 ? (
          <Text className="text-neutral-600 text-[10px]">
            {pageIndex + 1}/{pages.length}
          </Text>
        ) : null}
      </View>
      {formatName && !isPreviewingNextRound ? (
        <Text className="text-neutral-600 text-[10px] px-3 pt-2">{formatName}</Text>
      ) : null}
      <View className="gap-1.5 p-2">
        {visibleRows.map((row) => (
          <TeeSheetRow key={row.groupId} row={row} compact={compact} />
        ))}
      </View>
    </View>
  );
}
