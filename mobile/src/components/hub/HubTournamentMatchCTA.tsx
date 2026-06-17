import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { ChevronRight, ClipboardList } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';

import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  findMatchGroupForRosterPlayer,
  getActiveRoundNumber,
  isTournamentActiveToday,
  resolveTournamentScorecardRoute,
} from '@/lib/tournament-scorecard-routing';
import { getTournamentMatchGroups } from '@/lib/tournament-match-service';
import { getTournamentRosterPlayerIdsForUser } from '@/lib/tournament-player-service';
import { getTournamentsForUserList } from '@/lib/tournament-service';
import { formatRoundPickerLabel } from '@/lib/tournament-labels';
import { foxColors } from '@/theme/tokens';

interface HubTournamentMatchCTAProps {
  userId: string | undefined;
  previewMode?: boolean;
}

export function HubTournamentMatchCTA({ userId, previewMode = false }: HubTournamentMatchCTAProps) {
  const router = useRouter();

  const { data: myEvents = [] } = useQuery({
    queryKey: ['hubMyEvents', userId],
    queryFn: () => getTournamentsForUserList(userId!, { limit: 5 }),
    enabled: Boolean(userId) && !previewMode,
    staleTime: 1000 * 60 * 2,
  });

  const activeTournaments = myEvents.filter((tournament) =>
    isTournamentActiveToday(tournament.start_date, tournament.end_date)
  );

  const tournament = activeTournaments.length === 1 ? activeTournaments[0] : null;

  const { data: matchContext, isLoading } = useQuery({
    queryKey: ['hubTodayMatch', userId, tournament?.id],
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

  if (previewMode || !tournament || isLoading) {
    if (isLoading && tournament) {
      return (
        <View className="py-4 items-center">
          <ActivityIndicator color={foxColors.lime} />
        </View>
      );
    }
    return null;
  }

  if (!matchContext) {
    return null;
  }

  const roundLabel = formatRoundPickerLabel(tournament, matchContext.activeRound);

  return (
    <Animated.View entering={FadeInDown.delay(150).duration(600)}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push(matchContext.scorecardRoute as never);
        }}
        className="active:opacity-80 active:scale-[0.99]"
      >
        <SurfaceCard variant="accent" className="p-4 pl-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="w-12 h-12 bg-fox-lime-muted/40 rounded-full items-center justify-center mr-4 border border-fox-border-accent">
                <ClipboardList size={22} color={foxColors.lime} />
              </View>
              <View className="flex-1 pr-2">
                <Text className="text-fox-lime text-lg font-display">Enter today&apos;s match</Text>
                <Text className="text-lime-400/70 text-sm mt-0.5 font-body" numberOfLines={2}>
                  {tournament.name} · {roundLabel}
                </Text>
              </View>
            </View>
            <ChevronRight size={22} color={foxColors.lime} />
          </View>
        </SurfaceCard>
      </Pressable>
    </Animated.View>
  );
}
