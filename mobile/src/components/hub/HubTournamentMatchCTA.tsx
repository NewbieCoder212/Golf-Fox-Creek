import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { ChevronRight, ClipboardList, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';

import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  findMatchGroupForRosterPlayer,
  formatTeeTimeLabel,
  getActiveRoundNumber,
  isTournamentActiveToday,
  resolveTournamentScorecardRoute,
} from '@/lib/tournament-scorecard-routing';
import { getTournamentMatchGroups } from '@/lib/tournament-match-service';
import { getTournamentRosterPlayerIdsForUser } from '@/lib/tournament-player-service';
import { getTournamentsForUserList } from '@/lib/tournament-service';
import { formatRoundPickerLabel } from '@/lib/tournament-labels';
import { useTranslations } from '@/lib/language-store';
import type { Tournament } from '@/types';
import { foxColors } from '@/theme/tokens';

interface HubTournamentMatchCTAProps {
  userId: string | undefined;
  previewMode?: boolean;
  primaryTournament?: Tournament | null;
  compact?: boolean;
}

export function HubTournamentMatchCTA({
  userId,
  previewMode = false,
  primaryTournament,
  compact = false,
}: HubTournamentMatchCTAProps) {
  const router = useRouter();
  const t = useTranslations();

  const { data: myEvents = [] } = useQuery({
    queryKey: ['hubMyEvents', userId],
    queryFn: () => getTournamentsForUserList(userId!, { limit: 5 }),
    enabled: Boolean(userId) && !previewMode && !primaryTournament,
    staleTime: 1000 * 60 * 2,
  });

  const events = primaryTournament ? [primaryTournament] : myEvents;

  const activeTournaments = events.filter((tournament) =>
    isTournamentActiveToday(tournament.start_date, tournament.end_date)
  );

  const tournament = activeTournaments[0] ?? null;

  const { data: matchContext, isPending } = useQuery({
    queryKey: ['hubTodayMatch', userId, tournament],
    queryFn: async () => {
      if (!userId || !tournament) return null;
      const [matchGroups, rosterPlayerIds] = await Promise.all([
        getTournamentMatchGroups(tournament.id),
        getTournamentRosterPlayerIdsForUser(tournament.id, userId),
      ]);
      const activeRound = getActiveRoundNumber(tournament);
      const match = findMatchGroupForRosterPlayer(matchGroups, rosterPlayerIds, activeRound);
      if (!match) return null;
      return {
        tournament,
        activeRound,
        match,
        scorecardRoute: await resolveTournamentScorecardRoute(tournament.id, userId, activeRound),
      };
    },
    enabled: Boolean(userId && tournament && !previewMode),
    staleTime: 1000 * 60,
  });

  const sectionClass = compact ? 'px-5 mt-2' : 'px-5 mt-4';

  if (previewMode || !tournament) {
    return null;
  }

  if (isPending) {
    return (
      <View className={`${sectionClass} py-3 items-center`}>
        <ActivityIndicator color={foxColors.lime} />
      </View>
    );
  }

  if (!matchContext) {
    return (
      <Animated.View entering={FadeInDown.delay(150).duration(600)} className={sectionClass}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/tournaments/${tournament.id}` as never);
          }}
          className="active:opacity-80"
        >
          <SurfaceCard className={compact ? 'p-3' : 'p-4'}>
            <Text className="text-neutral-300 text-sm font-body-semibold">{t.noPairingToday}</Text>
            <Text className="text-neutral-500 text-sm font-body mt-1">{t.contactCaptain}</Text>
            <View className="flex-row items-center mt-3 pt-2 border-t border-fox-border/60">
              <Text className="text-fox-lime text-sm font-body-semibold flex-1">
                {t.tapToEnterTournament}
              </Text>
              <ChevronRight size={18} color={foxColors.lime} />
            </View>
          </SurfaceCard>
        </Pressable>
      </Animated.View>
    );
  }

  const roundLabel = formatRoundPickerLabel(tournament, matchContext.activeRound);
  const matchGroup = matchContext.match.group;
  const teeTimeLabel = matchGroup.tee_time ? formatTeeTimeLabel(matchGroup.tee_time) : null;
  const startingHole = matchGroup.starting_hole;

  return (
    <Animated.View entering={FadeInDown.delay(150).duration(600)} className={sectionClass}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push(matchContext.scorecardRoute as never);
        }}
        className="active:opacity-80 active:scale-[0.99]"
      >
        <SurfaceCard variant="accent" className={compact ? 'p-3 pl-4' : 'p-4 pl-5'}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View
                className={`bg-fox-lime-muted/40 rounded-full items-center justify-center mr-3 border border-fox-border-accent ${
                  compact ? 'w-10 h-10' : 'w-12 h-12'
                }`}
              >
                <ClipboardList size={compact ? 18 : 22} color={foxColors.lime} />
              </View>
              <View className="flex-1 pr-2">
                <Text className={`text-fox-lime font-display ${compact ? 'text-base' : 'text-lg'}`}>
                  {t.enterTodaysMatch}
                </Text>
                <Text className="text-lime-400/70 text-sm mt-0.5 font-body" numberOfLines={1}>
                  {tournament.name} · {roundLabel}
                </Text>
                {teeTimeLabel || startingHole ? (
                  <View className="flex-row items-center mt-1.5 gap-1">
                    <Clock size={12} color="#84cc16" />
                    <Text className="text-lime-400/60 text-xs font-body">
                      {teeTimeLabel}
                      {teeTimeLabel && startingHole ? ' · ' : ''}
                      {startingHole ? `${t.hole} ${startingHole}` : ''}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <ChevronRight size={22} color={foxColors.lime} />
          </View>
          <View className="flex-row items-center mt-3 pt-2 border-t border-fox-border-accent/40">
            <Text className="text-fox-lime text-sm font-body-semibold flex-1">
              {t.tapToEnterTournament}
            </Text>
            <ChevronRight size={16} color={foxColors.lime} />
          </View>
        </SurfaceCard>
      </Pressable>
    </Animated.View>
  );
}
