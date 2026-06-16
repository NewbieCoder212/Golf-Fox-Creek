import { View, Text, ScrollView, Pressable } from 'react-native';
import { ChevronRight, Trophy, Calendar } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';

import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useTranslations } from '@/lib/language-store';
import { getTournamentsForUserList } from '@/lib/tournament-service';
import { formatTournamentDates } from '@/lib/tournament-labels';
import { foxColors } from '@/theme/tokens';

interface HubMyEventsStripProps {
  userId: string | undefined;
  embedded?: boolean;
}

export function HubMyEventsStrip({ userId, embedded = false }: HubMyEventsStripProps) {
  const router = useRouter();
  const t = useTranslations();

  const { data: tournaments = [] } = useQuery({
    queryKey: ['hubMyEvents', userId],
    queryFn: () => getTournamentsForUserList(userId!, { limit: 3 }),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
  });

  if (tournaments.length === 0) {
    if (embedded) {
      return (
        <View className="py-5 items-center">
          <View className="w-11 h-11 bg-fox-surface-elevated rounded-full items-center justify-center border border-fox-border">
            <Trophy size={20} color="#525252" strokeWidth={1.5} />
          </View>
          <Text className="text-neutral-500 text-sm font-body mt-3 text-center">
            {t.noUpcomingEvents}
          </Text>
        </View>
      );
    }
    return null;
  }

  const cards = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12 }}
      style={{ flexGrow: 0, marginHorizontal: embedded ? -4 : 0 }}
    >
      {tournaments.map((tournament) => (
        <Pressable
          key={tournament.id}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/tournaments/${tournament.id}` as never);
          }}
          className="active:opacity-80 active:scale-[0.98]"
          style={{ width: 240 }}
        >
          <SurfaceCard variant="accent" className="p-4 pl-5">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-2">
                <View className="flex-row items-center gap-2 mb-2">
                  <Trophy size={16} color={foxColors.lime} strokeWidth={1.5} />
                  <Text className="text-fox-lime text-xs font-body-semibold uppercase tracking-wide">
                    {t.event}
                  </Text>
                </View>
                <Text className="text-white text-base font-display" numberOfLines={2}>
                  {tournament.name}
                </Text>
                <View className="flex-row items-center mt-2 gap-1.5">
                  <Calendar size={12} color="#737373" />
                  <Text className="text-neutral-500 text-xs font-body">
                    {formatTournamentDates(tournament.start_date, tournament.end_date)}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={foxColors.lime} />
            </View>
          </SurfaceCard>
        </Pressable>
      ))}
    </ScrollView>
  );

  if (embedded) {
    return cards;
  }

  return (
    <Animated.View entering={FadeInDown.delay(250).duration(600)} className="mt-4">
      <View className="px-5 mb-3 flex-row items-center justify-between">
        <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] font-body-semibold">
          {t.myEvents}
        </Text>
        <Pressable onPress={() => router.push('/tournaments' as never)} hitSlop={8} className="active:opacity-70">
          <Text className="text-fox-lime text-xs font-body-semibold">{t.viewAll}</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
      >
        {tournaments.map((tournament) => (
          <Pressable
            key={tournament.id}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/tournaments/${tournament.id}` as never);
            }}
            className="active:opacity-80 active:scale-[0.98]"
            style={{ width: 260 }}
          >
            <SurfaceCard variant="accent" className="p-4 pl-5">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <View className="flex-row items-center gap-2 mb-2">
                    <Trophy size={16} color={foxColors.lime} strokeWidth={1.5} />
                    <Text className="text-fox-lime text-xs font-body-semibold uppercase tracking-wide">
                      {t.event}
                    </Text>
                  </View>
                  <Text className="text-white text-base font-display" numberOfLines={2}>
                    {tournament.name}
                  </Text>
                  <View className="flex-row items-center mt-2 gap-1.5">
                    <Calendar size={12} color="#737373" />
                    <Text className="text-neutral-500 text-xs font-body">
                      {formatTournamentDates(tournament.start_date, tournament.end_date)}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color={foxColors.lime} />
              </View>
            </SurfaceCard>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}
