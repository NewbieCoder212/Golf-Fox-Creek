import { useEffect, useMemo, useState } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';

import { TournamentMatchGridCard } from '@/components/TournamentMatchGridCard';
import type { MatchGridCardVariant } from '@/components/TournamentMatchGridCard';
import {
  buildMatchGridModels,
  groupMatchGridsByRound,
} from '@/lib/tournament-match-grid';
import type { MatchGridModel } from '@/lib/tournament-match-grid';
import { cn } from '@/lib/cn';
import type { TournamentMatchGroup, TournamentMatchHoleResult, TournamentScore } from '@/types';

interface TournamentLiveMatchGridsProps {
  matchGroups: TournamentMatchGroup[];
  scores: TournamentScore[];
  holeResults?: TournamentMatchHoleResult[];
  teamNameById: Record<string, string>;
  playerNameById: Record<string, string>;
  useNetScoring: boolean;
  variant?: MatchGridCardVariant;
  roundNumber?: number;
  hideTitle?: boolean;
  layout?: 'stack' | 'tv-row' | 'tv-carousel';
}

const TV_CAROUSEL_INTERVAL_MS = 12_000;
const TV_LIVE_CAROUSEL_INTERVAL_MS = 8_000;
const TV_FINISHED_CAROUSEL_INTERVAL_MS = 18_000;
const TV_MIN_CARD_WIDTH = 300;

type TvCarouselPhase = 'live' | 'finished' | 'all';

function isFinishedMatch(model: MatchGridModel): boolean {
  return !model.inProgress && model.throughHole > 0;
}

function chunkMatches<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages.length > 0 ? pages : [[]];
}

function TvMatchCarousel({
  matches,
  variant,
  cardsPerPage,
  prioritizeLive = true,
}: {
  matches: MatchGridModel[];
  variant: MatchGridCardVariant;
  cardsPerPage: number;
  prioritizeLive?: boolean;
}) {
  const liveMatches = useMemo(() => matches.filter((model) => model.inProgress), [matches]);
  const finishedMatches = useMemo(() => matches.filter(isFinishedMatch), [matches]);
  const hasLive = liveMatches.length > 0;
  const hasFinished = finishedMatches.length > 0;
  const alternatesPhases = prioritizeLive && hasLive && hasFinished;

  const [phase, setPhase] = useState<TvCarouselPhase>(() =>
    hasLive && prioritizeLive ? 'live' : 'all'
  );
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (!prioritizeLive || !hasLive) {
      setPhase('all');
      return;
    }
    setPhase((current) => {
      if (current === 'all') return 'live';
      if (current === 'finished' && !hasFinished) return 'live';
      return current;
    });
  }, [prioritizeLive, hasLive, hasFinished]);

  const activePhase: TvCarouselPhase =
    !prioritizeLive || !hasLive ? 'all' : alternatesPhases ? phase : 'live';

  const carouselMatches =
    activePhase === 'live'
      ? liveMatches
      : activePhase === 'finished'
        ? finishedMatches
        : matches;

  const effectiveCardsPerPage =
    activePhase === 'live'
      ? Math.min(2, cardsPerPage)
      : activePhase === 'finished'
        ? Math.min(3, cardsPerPage)
        : cardsPerPage;

  const intervalMs =
    activePhase === 'live'
      ? TV_LIVE_CAROUSEL_INTERVAL_MS
      : activePhase === 'finished'
        ? TV_FINISHED_CAROUSEL_INTERVAL_MS
        : TV_CAROUSEL_INTERVAL_MS;

  const pages = useMemo(
    () => chunkMatches(carouselMatches, effectiveCardsPerPage),
    [carouselMatches, effectiveCardsPerPage]
  );

  useEffect(() => {
    setPageIndex(0);
  }, [activePhase, carouselMatches, effectiveCardsPerPage]);

  useEffect(() => {
    if (carouselMatches.length === 0) return;

    const timer = setInterval(() => {
      setPageIndex((current) => {
        const isLastPage = current >= pages.length - 1;
        if (!isLastPage) return current + 1;

        if (alternatesPhases) {
          setPhase((currentPhase) => (currentPhase === 'live' ? 'finished' : 'live'));
        }
        return 0;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [pages.length, intervalMs, alternatesPhases, carouselMatches.length]);

  const currentPage = pages[pageIndex] ?? [];
  const rangeStart = pageIndex * effectiveCardsPerPage + 1;
  const rangeEnd = Math.min((pageIndex + 1) * effectiveCardsPerPage, carouselMatches.length);
  const cardVariant: MatchGridCardVariant =
    effectiveCardsPerPage <= 2 && variant === 'tv-compact' ? 'tv' : variant;

  const sectionTitle =
    activePhase === 'live'
      ? 'Live on the course'
      : activePhase === 'finished'
        ? 'Completed matches'
        : "Today's matches";

  const statusLine =
    activePhase === 'live'
      ? `${liveMatches.length} in progress${hasFinished ? ` · ${finishedMatches.length} done` : ''}`
      : activePhase === 'finished'
        ? `${finishedMatches.length} final${finishedMatches.length !== 1 ? 's' : ''} · slow pass`
        : `${matches.length} tee time${matches.length !== 1 ? 's' : ''}`;

  const showLiveBadge = activePhase === 'live';

  return (
    <View className="flex-1 min-h-0">
      <View className="flex-row items-center justify-between mb-2 px-0.5">
        <View className="flex-1 mr-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-neutral-500 text-[10px] uppercase tracking-widest">
              {sectionTitle}
            </Text>
            {showLiveBadge ? (
              <View className="flex-row items-center bg-lime-950/50 border border-lime-700/40 rounded-full px-2 py-0.5">
                <View className="w-1.5 h-1.5 rounded-full bg-lime-400 mr-1" />
                <Text className="text-lime-400 text-[9px] font-bold uppercase">Live</Text>
              </View>
            ) : null}
            {activePhase === 'finished' ? (
              <View className="flex-row items-center bg-neutral-800/80 border border-neutral-700/50 rounded-full px-2 py-0.5">
                <Text className="text-neutral-400 text-[9px] font-bold uppercase">Results</Text>
              </View>
            ) : null}
          </View>
          <Text className="text-neutral-600 text-[10px] mt-0.5">{statusLine}</Text>
        </View>
        <Text className="text-neutral-600 text-[10px] shrink-0 text-right">
          {rangeStart}–{rangeEnd} of {carouselMatches.length}
          {pages.length > 1 || alternatesPhases ? `\nauto · ${Math.round(intervalMs / 1000)}s` : ''}
        </Text>
      </View>

      <View className="flex-1 flex-row gap-3 min-h-0">
        {currentPage.map((model) => (
          <View key={model.matchGroupId} className="flex-1 min-w-0">
            <TournamentMatchGridCard
              model={model}
              variant={cardVariant}
              highlight={model.inProgress}
              fillHeight
            />
          </View>
        ))}
      </View>

      {pages.length > 1 ? (
        <View className="flex-row items-center justify-center gap-2 pt-2">
          {pages.map((_, index) => (
            <View
              key={`tv-page-${index}`}
              className={cn(
                'h-1.5 rounded-full',
                index === pageIndex
                  ? activePhase === 'finished'
                    ? 'w-6 bg-neutral-400'
                    : 'w-6 bg-lime-400'
                  : 'w-1.5 bg-neutral-700'
              )}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function TournamentLiveMatchGrids({
  matchGroups,
  scores,
  holeResults = [],
  teamNameById,
  playerNameById,
  useNetScoring,
  variant = 'default',
  roundNumber,
  hideTitle = false,
  layout = 'stack',
}: TournamentLiveMatchGridsProps) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const filteredGroups = useMemo(
    () =>
      roundNumber != null
        ? matchGroups.filter((group) => group.round_number === roundNumber)
        : matchGroups,
    [matchGroups, roundNumber]
  );

  const filteredScores = useMemo(
    () =>
      roundNumber != null
        ? scores.filter((score) => score.round_number === roundNumber)
        : scores,
    [scores, roundNumber]
  );

  const models = useMemo(
    () =>
      buildMatchGridModels({
        matchGroups: filteredGroups,
        allScores: filteredScores,
        allHoleResults: holeResults,
        teamNameById,
        playerNameById,
        useNetScoring,
      }),
    [filteredGroups, filteredScores, holeResults, teamNameById, playerNameById, useNetScoring]
  );

  const rounds = useMemo(() => groupMatchGridsByRound(models), [models]);
  const isTvRow = layout === 'tv-row';
  const isTvCarousel = layout === 'tv-carousel';

  const tvCardsPerPage = useMemo(() => {
    if (!isTvCarousel) return 1;
    const standingsWidth = 260;
    const padding = 32;
    const sponsorWidth = isLandscape ? 172 : 0;
    const mainWidth = Math.max(480, width - standingsWidth - padding - sponsorWidth);
    return Math.max(2, Math.min(4, Math.floor(mainWidth / TV_MIN_CARD_WIDTH)));
  }, [isTvCarousel, width, isLandscape]);

  if (filteredGroups.length === 0) {
    return (
      <View
        className={cn(
          'items-center justify-center bg-[#141414] rounded-xl border border-neutral-800',
          isTvRow || isTvCarousel ? 'flex-1 py-6' : 'py-8 mb-3'
        )}
      >
        <Text className="text-neutral-500 text-sm">
          {roundNumber != null ? `No matches for round ${roundNumber}` : 'No match pairings yet'}
        </Text>
      </View>
    );
  }

  const matches = rounds.flatMap((round) => round.matches);

  if (isTvCarousel) {
    return (
      <TvMatchCarousel
        matches={matches}
        variant={variant}
        cardsPerPage={tvCardsPerPage}
        prioritizeLive
      />
    );
  }

  if (isTvRow) {
    return (
      <View className="flex-1 flex-row gap-2 min-h-0">
        {matches.map((model) => (
          <View key={model.matchGroupId} className="flex-1 min-w-0">
            <TournamentMatchGridCard
              model={model}
              variant={variant}
              highlight={model.inProgress}
              fillHeight
            />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="mb-3">
      {!hideTitle ? (
        <Text
          className={cn(
            'text-neutral-500 uppercase tracking-widest mb-3',
            variant === 'tv' || variant === 'tv-compact' ? 'text-sm' : 'text-xs'
          )}
        >
          Match Scorecards
        </Text>
      ) : null}
      {rounds.map(({ roundNumber: round, matches: roundMatches }) => (
        <View key={`round-${round}`} className="mb-2">
          {rounds.length > 1 ? (
            <Text
              className={cn(
                'text-neutral-400 font-semibold mb-2 ml-1',
                variant === 'tv' || variant === 'tv-compact' ? 'text-sm' : 'text-xs'
              )}
            >
              Round {round}
            </Text>
          ) : null}
          {roundMatches.map((model) => (
            <TournamentMatchGridCard
              key={model.matchGroupId}
              model={model}
              variant={variant}
              highlight={model.inProgress}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
