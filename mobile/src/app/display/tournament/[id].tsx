import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Radio } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchTournamentDisplay, buildQrCodeUrl, buildTournamentMobileUrl } from '@/lib/display-service';
import { useTournamentDisplayRealtime } from '@/hooks/useTournamentDisplayRealtime';
import { formatTournamentDates } from '@/lib/tournament-labels';
import { formatClubTime } from '@/lib/club-timezone';
import { TvSponsorCarousel, TvSponsorSlot } from '@/components/TvSponsorSlot';
import type { DisplayStandingRow } from '@/types';
import { cn } from '@/lib/cn';

function StandingRow({ row, highlight }: { row: DisplayStandingRow; highlight: boolean }) {
  return (
    <View
      className={cn(
        'flex-row items-center px-4 py-3 border-b border-neutral-800/80',
        highlight && 'bg-lime-950/20'
      )}
    >
      <View
        className={cn(
          'w-10 h-10 rounded-full items-center justify-center mr-4',
          row.rank === 1 ? 'bg-yellow-500/20' : 'bg-neutral-800'
        )}
      >
        <Text
          className={cn('font-bold text-base', row.rank === 1 ? 'text-yellow-400' : 'text-neutral-400')}
        >
          {row.rank}
        </Text>
      </View>
      <View className="flex-1 mr-3">
        <Text className="text-white font-semibold text-lg" numberOfLines={1}>
          {row.name}
        </Text>
        <Text className="text-neutral-500 text-sm mt-0.5">{row.detail}</Text>
      </View>
      <Text className="text-lime-400 font-bold text-3xl">{row.score}</Text>
    </View>
  );
}

export default function TournamentTvDisplayScreen() {
  const { id, token } = useLocalSearchParams<{ id: string; token?: string }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [scoreMode, setScoreMode] = useState<'net' | 'gross'>('net');

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['tournamentDisplay', id, token],
    queryFn: () => fetchTournamentDisplay(id!, token!),
    enabled: Boolean(id && token),
    staleTime: 15_000,
  });

  const handleRealtimeUpdate = useCallback(() => {
    void refetch();
  }, [refetch]);

  useTournamentDisplayRealtime(id, handleRealtimeUpdate);

  const standings = useMemo(
    () => (scoreMode === 'net' ? data?.netStandings : data?.grossStandings) ?? [],
    [data, scoreMode]
  );

  const mobileUrl = id ? buildTournamentMobileUrl(id) : '';
  const qrUrl = mobileUrl ? buildQrCodeUrl(mobileUrl, isLandscape ? 160 : 140) : '';

  if (!token) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center px-8">
        <Text className="text-white text-2xl font-bold text-center">Invalid display link</Text>
        <Text className="text-neutral-400 text-center mt-3">
          Ask the pro shop for the full TV display URL including the access token.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center">
        <ActivityIndicator size="large" color="#a3e635" />
        <Text className="text-neutral-500 mt-4">Loading live standings…</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 bg-[#0c0c0c] items-center justify-center px-8">
        <Text className="text-white text-2xl font-bold text-center">Unable to load display</Text>
        <Text className="text-neutral-400 text-center mt-3">
          {error instanceof Error ? error.message : 'Check the link or try again.'}
        </Text>
      </View>
    );
  }

  const hasMatchPoints = data.matchPoints.some((row) => row.matchPoints > 0);
  const lastUpdated = formatClubTime(new Date(dataUpdatedAt).toISOString(), true);

  return (
    <View className="flex-1 bg-[#0c0c0c]" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Header */}
      <View className="px-6 py-4 border-b border-neutral-800 bg-[#111111]">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-4">
            {data.sponsors.header_left[0] && isLandscape ? (
              <View className="w-44 mr-4">
                <TvSponsorSlot sponsor={data.sponsors.header_left[0]} variant="header" />
              </View>
            ) : null}
            <View className="flex-1">
              <Text className="text-lime-400 text-xs font-semibold uppercase tracking-[0.25em]">
                Fox Creek Golf Club
              </Text>
              <Text className="text-white text-3xl font-bold mt-1" numberOfLines={2}>
                {data.tournament.name}
              </Text>
              <Text className="text-neutral-400 text-base mt-1">
                {formatTournamentDates(data.tournament.start_date, data.tournament.end_date)}
              </Text>
            </View>
          </View>

          <View className="items-end">
            <View className="flex-row items-center bg-lime-950/40 border border-lime-700/30 rounded-full px-3 py-1.5">
              <Radio size={14} color="#a3e635" />
              <Text className="text-lime-400 text-xs font-semibold ml-1.5 uppercase tracking-wider">
                Live
              </Text>
              {isFetching ? (
                <ActivityIndicator size="small" color="#a3e635" style={{ marginLeft: 8 }} />
              ) : null}
            </View>
            <Text className="text-neutral-600 text-xs mt-2">Updated {lastUpdated}</Text>
          </View>
        </View>
      </View>

      <View className={cn('flex-1 flex-row', !isLandscape && 'flex-col')}>
        {/* Leaderboard column */}
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="px-6 pt-5 pb-2 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Trophy size={22} color="#a3e635" />
              <Text className="text-white text-xl font-bold ml-2">Standings</Text>
            </View>
            <View className="flex-row bg-neutral-900 rounded-lg border border-neutral-800 p-0.5">
              {(['net', 'gross'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setScoreMode(mode)}
                  className={cn(
                    'px-4 py-2 rounded-md',
                    scoreMode === mode && 'bg-lime-600'
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs font-bold uppercase tracking-wider',
                      scoreMode === mode ? 'text-white' : 'text-neutral-500'
                    )}
                  >
                    {mode}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {hasMatchPoints ? (
            <View className="mx-6 mb-4 bg-[#141414] rounded-2xl border border-lime-700/30 overflow-hidden">
              <Text className="text-neutral-500 text-xs uppercase tracking-widest px-4 pt-4 pb-2">
                Match Points
              </Text>
              {data.matchPoints.map((row) => (
                <View
                  key={`${row.rank}-${row.teamName}`}
                  className="flex-row items-center px-4 py-3 border-t border-neutral-800/80"
                >
                  <Text className="text-neutral-500 w-8 font-bold">{row.rank}</Text>
                  <Text className="text-white font-semibold flex-1 text-lg">{row.teamName}</Text>
                  <Text className="text-lime-400 font-bold text-2xl mr-3">{row.matchPoints}</Text>
                  <Text className="text-neutral-600 text-xs">
                    {row.matchesWon}W / {row.matchesPlayed}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {data.matchPlay ? (
            <View className="mx-6 mb-4 bg-[#141414] rounded-2xl border border-neutral-800 p-4">
              <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3 text-center">
                Team Match Play
              </Text>
              <View className="flex-row items-center justify-between">
                <View className="flex-1 items-center">
                  <Text className="text-lime-400 text-xs font-bold uppercase">{data.matchPlay.sideAName}</Text>
                  <Text className="text-white text-4xl font-bold mt-1">{data.matchPlay.sideAHoles}</Text>
                </View>
                <Text className="text-neutral-600 text-lg font-bold px-4">vs</Text>
                <View className="flex-1 items-center">
                  <Text className="text-lime-400 text-xs font-bold uppercase">{data.matchPlay.sideBName}</Text>
                  <Text className="text-white text-4xl font-bold mt-1">{data.matchPlay.sideBHoles}</Text>
                </View>
              </View>
            </View>
          ) : null}

          <View className="mx-6 bg-[#141414] rounded-2xl border border-neutral-800 overflow-hidden">
            {standings.length === 0 ? (
              <View className="py-16 items-center">
                <Text className="text-neutral-500 text-lg">No scores yet</Text>
                <Text className="text-neutral-600 text-sm mt-2">Standings update automatically</Text>
              </View>
            ) : (
              standings.map((row) => (
                <StandingRow key={`${row.rank}-${row.name}`} row={row} highlight={row.rank <= 3} />
              ))
            )}
          </View>

          {!isLandscape && data.sponsors.sidebar.length > 0 ? (
            <View className="px-6 mt-4">
              <TvSponsorCarousel sponsors={data.sponsors.sidebar} />
            </View>
          ) : null}
        </ScrollView>

        {/* Sidebar sponsors (landscape) */}
        {isLandscape && data.sponsors.sidebar.length > 0 ? (
          <View className="w-72 border-l border-neutral-800 bg-[#111111] p-4 justify-center">
            <Text className="text-neutral-600 text-[10px] uppercase tracking-widest mb-3">
              Presented by
            </Text>
            <TvSponsorCarousel sponsors={data.sponsors.sidebar} />
          </View>
        ) : null}
      </View>

      {/* Footer + QR */}
      <View className="border-t border-neutral-800 bg-[#111111] px-6 py-4">
        <View className="flex-row items-end justify-between">
          <View className="flex-1 mr-4">
            {data.sponsors.footer.length > 0 ? (
              <TvSponsorCarousel sponsors={data.sponsors.footer} variant="footer" />
            ) : (
              <Text className="text-neutral-600 text-sm">Fox Creek Golf Club · Dieppe, NB</Text>
            )}
          </View>

          {qrUrl ? (
            <View className="items-center">
              <Image source={{ uri: qrUrl }} style={{ width: 100, height: 100 }} />
              <Text className="text-neutral-500 text-[10px] mt-1 text-center max-w-[120px]">
                Scan for tournament in app
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
