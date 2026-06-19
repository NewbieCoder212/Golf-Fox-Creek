import { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';

import {
  buildTournamentTeeSheetRows,
  type TeeSheetDisplayStatus,
  type TournamentTeeSheetRow,
} from '@/lib/tournament-tee-sheet';
import { formatLabel, formatRoundPickerLabel } from '@/lib/tournament-labels';
import { formatClubTime } from '@/lib/club-timezone';
import { SIDE_A_COLOR, SIDE_B_COLOR } from '@/lib/match-play-theme';
import { cn } from '@/lib/cn';
import type {
  Tournament,
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentTeam,
} from '@/types';

const ROWS_PER_PAGE_DEFAULT = 5;
const ROWS_PER_PAGE_LOUNGE = 3;
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
  loungeMode?: boolean;
  compact?: boolean;
  className?: string;
}

function StatusPill({
  status,
  loungeMode = false,
}: {
  status: TeeSheetDisplayStatus;
  loungeMode?: boolean;
}) {
  return (
    <View
      className={cn(
        'rounded-full border shrink-0',
        loungeMode ? 'px-3 py-1' : 'px-2 py-0.5',
        status === 'live' && 'bg-lime-950/50 border-lime-600/50',
        status === 'on_course' && 'bg-amber-950/40 border-amber-600/50',
        status === 'upcoming' && 'bg-neutral-900 border-neutral-700',
        status === 'complete' && 'bg-neutral-900/80 border-neutral-800'
      )}
    >
      <Text
        className={cn(
          'font-bold uppercase tracking-wider',
          loungeMode ? 'text-sm' : 'text-[9px]',
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

function TeeSheetRow({
  row,
  compact,
  loungeMode = false,
}: {
  row: TournamentTeeSheetRow;
  compact?: boolean;
  loungeMode?: boolean;
}) {
  const isHighlighted = row.displayStatus === 'live' || row.displayStatus === 'on_course';
  const hidePlayers = compact || loungeMode;

  return (
    <View
      className={cn(
        'rounded-lg border',
        loungeMode ? 'px-4 py-3' : 'px-2.5 py-2',
        isHighlighted ? 'border-lime-700/40 bg-lime-950/20' : 'border-neutral-800 bg-[#0a0a0a]',
        row.displayStatus === 'complete' && !loungeMode && 'opacity-60'
      )}
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 min-w-0">
          <Text
            className={cn('text-white font-bold', loungeMode ? 'text-2xl' : 'text-xs')}
            numberOfLines={1}
          >
            {row.teeTimeLabel}
            <Text className={cn('text-neutral-500 font-semibold', loungeMode ? 'text-xl' : undefined)}>
              {' '}
              · G{row.groupNumber}
            </Text>
          </Text>
          <Text
            className={cn('font-bold mt-1', loungeMode ? 'text-xl' : 'text-[10px]')}
            numberOfLines={1}
          >
            <Text style={{ color: SIDE_A_COLOR }}>{row.sideAName}</Text>
            <Text className="text-neutral-500"> vs </Text>
            <Text style={{ color: SIDE_B_COLOR }}>{row.sideBName}</Text>
          </Text>
          {!hidePlayers ? (
            <Text className="text-neutral-500 text-[10px] mt-0.5" numberOfLines={2}>
              {row.playersLabel}
            </Text>
          ) : null}
          {row.resultSummary && !loungeMode ? (
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
        <StatusPill status={row.displayStatus} loungeMode={loungeMode} />
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
  loungeMode = false,
  compact = false,
  className,
}: TournamentTvTeeSheetProps) {
  const [now, setNow] = useState(() => new Date());
  const [pageIndex, setPageIndex] = useState(0);
  const rowsPerPage = loungeMode ? ROWS_PER_PAGE_LOUNGE : ROWS_PER_PAGE_DEFAULT;

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
    if (rows.length <= rowsPerPage) return [rows];
    const result: TournamentTeeSheetRow[][] = [];
    for (let index = 0; index < rows.length; index += rowsPerPage) {
      result.push(rows.slice(index, index + rowsPerPage));
    }
    return result;
  }, [rows, rowsPerPage]);

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
      <View
        className={cn(
          'border-b border-neutral-800 flex-row items-center justify-between',
          loungeMode ? 'px-4 py-3' : 'px-3 py-2'
        )}
      >
        <View className="flex-1 min-w-0 mr-2">
          <View className="flex-row items-center gap-2">
            <Text
              className={cn(
                'text-neutral-400 font-semibold uppercase tracking-widest',
                loungeMode ? 'text-sm' : 'text-[10px]'
              )}
            >
              {isPreviewingNextRound ? 'Up next' : 'Tee sheet'}
            </Text>
            {isPreviewingNextRound ? (
              <View className="rounded-full px-2 py-0.5 border bg-lime-950/40 border-lime-700/40">
                <Text
                  className={cn(
                    'text-lime-400 font-bold uppercase tracking-wider',
                    loungeMode ? 'text-xs' : 'text-[8px]'
                  )}
                >
                  Preview
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            className={cn(
              'text-lime-400/90 font-semibold mt-0.5',
              loungeMode ? 'text-lg' : 'text-[10px]'
            )}
            numberOfLines={1}
          >
            {roundLabel}
          </Text>
          <Text className={cn('text-neutral-600 mt-0.5', loungeMode ? 'text-sm' : 'text-[10px]')}>
            Now {clubClockLabel}
          </Text>
        </View>
        {pages.length > 1 ? (
          <Text className={cn('text-neutral-600', loungeMode ? 'text-sm' : 'text-[10px]')}>
            {pageIndex + 1}/{pages.length}
          </Text>
        ) : null}
      </View>
      {formatName && !isPreviewingNextRound && !loungeMode ? (
        <Text className="text-neutral-600 text-[10px] px-3 pt-2">{formatName}</Text>
      ) : null}
      <View className={cn(loungeMode ? 'gap-2 p-3' : 'gap-1.5 p-2')}>
        {visibleRows.map((row) => (
          <TeeSheetRow
            key={row.groupId}
            row={row}
            compact={compact}
            loungeMode={loungeMode}
          />
        ))}
      </View>
    </View>
  );
}
