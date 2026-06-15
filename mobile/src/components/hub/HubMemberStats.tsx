import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Target, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useTranslations } from '@/lib/language-store';
import { foxColors } from '@/theme/tokens';

interface HubMemberStatsProps {
  handicap: number | null;
  loyaltyPoints: number;
  loading?: boolean;
}

export function HubMemberStats({ handicap, loyaltyPoints, loading }: HubMemberStatsProps) {
  const router = useRouter();
  const t = useTranslations();

  const handleHandicapPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/history' as never);
  };

  return (
    <Animated.View entering={FadeInDown.delay(600).duration(500)} className="flex-row gap-2">
      <Pressable
        onPress={handleHandicapPress}
        className="flex-1 flex-row items-center bg-fox-surface-elevated rounded-xl px-3 py-2.5 border border-fox-border active:opacity-80"
      >
        <Target size={16} color={foxColors.lime} strokeWidth={1.5} />
        <View className="ml-2 flex-1">
          <Text className="text-neutral-500 text-[10px] font-body-semibold uppercase tracking-wide">
            {t.handicap}
          </Text>
          {loading ? (
            <ActivityIndicator size="small" color={foxColors.lime} className="mt-0.5" />
          ) : (
            <Text className="text-white text-lg font-display">
              {handicap !== null ? handicap.toFixed(1) : '--'}
            </Text>
          )}
        </View>
      </Pressable>
      <View className="flex-1 flex-row items-center bg-fox-surface-elevated rounded-xl px-3 py-2.5 border border-fox-border">
        <Star size={16} color={foxColors.gold} strokeWidth={1.5} />
        <View className="ml-2 flex-1">
          <Text className="text-neutral-500 text-[10px] font-body-semibold uppercase tracking-wide">
            {t.points}
          </Text>
          {loading ? (
            <ActivityIndicator size="small" color={foxColors.gold} className="mt-0.5" />
          ) : (
            <Text className="text-white text-lg font-display">
              {loyaltyPoints.toLocaleString()}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
