import { View, Text, Pressable } from 'react-native';
import { Calendar, ChevronRight, Trophy } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useTranslations } from '@/lib/language-store';
import { formatTournamentDates } from '@/lib/tournament-labels';
import { isTournamentActiveToday } from '@/lib/tournament-scorecard-routing';
import type { Tournament } from '@/types';
import { foxColors } from '@/theme/tokens';

interface HubEventSummaryCardProps {
  tournament: Tournament | null | undefined;
  showNoEventAssigned?: boolean;
  compact?: boolean;
  userId?: string;
}

export function HubEventSummaryCard({
  tournament,
  showNoEventAssigned = false,
  compact = false,
}: HubEventSummaryCardProps) {
  const router = useRouter();
  const t = useTranslations();
  const sectionClass = compact ? 'px-5 mt-2' : 'px-5 mt-4';

  if (showNoEventAssigned || !tournament) {
    return (
      <Animated.View entering={FadeInDown.delay(150).duration(600)} className={sectionClass}>
        <SurfaceCard className={compact ? 'p-3' : 'p-4'}>
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-fox-surface-elevated rounded-full items-center justify-center mr-3 border border-fox-border">
              <Trophy size={18} color="#525252" strokeWidth={1.5} />
            </View>
            <Text className="text-neutral-400 text-sm font-body flex-1">{t.noEventAssigned}</Text>
          </View>
        </SurfaceCard>
      </Animated.View>
    );
  }

  const isEventDay = isTournamentActiveToday(tournament.start_date, tournament.end_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(tournament.start_date);
  start.setHours(0, 0, 0, 0);

  let statusMessage: string = t.noMatchToday;
  if (today < start) {
    statusMessage = `${t.tournamentStarts} ${formatTournamentDates(tournament.start_date, tournament.end_date)}`;
  } else if (!isEventDay) {
    statusMessage = t.tournamentEnded;
  }

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/tournaments/${tournament.id}` as never);
  };

  return (
    <Animated.View entering={FadeInDown.delay(150).duration(600)} className={sectionClass}>
      <Pressable onPress={handlePress} className="active:opacity-80 active:scale-[0.99]">
        <SurfaceCard variant="accent" className={compact ? 'p-3 pl-4' : 'p-4 pl-5'}>
          <View className="flex-row items-center gap-2 mb-1.5">
            <Trophy size={16} color={foxColors.lime} strokeWidth={1.5} />
            <Text className="text-fox-lime text-xs font-body-semibold uppercase tracking-wide">
              {t.event}
            </Text>
          </View>
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-2">
              <Text className={`text-white font-display ${compact ? 'text-base' : 'text-lg'}`}>
                {tournament.name}
              </Text>
              <View className="flex-row items-center mt-1.5 gap-1.5">
                <Calendar size={12} color="#737373" />
                <Text className="text-neutral-500 text-xs font-body">
                  {formatTournamentDates(tournament.start_date, tournament.end_date)}
                </Text>
              </View>
              <Text className={`text-neutral-400 font-body mt-2 ${compact ? 'text-xs' : 'text-sm'}`}>
                {statusMessage}
              </Text>
              <View className="flex-row items-center mt-3 pt-2 border-t border-fox-border-accent/40">
                <Text className="text-fox-lime text-sm font-body-semibold flex-1">
                  {t.tapToEnterTournament}
                </Text>
                <ChevronRight size={18} color={foxColors.lime} />
              </View>
            </View>
          </View>
        </SurfaceCard>
      </Pressable>
    </Animated.View>
  );
}
