import { View } from 'react-native';
import { Target, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { StatPill } from '@/components/ui/StatPill';
import { useTranslations } from '@/lib/language-store';
import { foxColors } from '@/theme/tokens';

interface HubStatsRowProps {
  handicap: number | null;
  loyaltyPoints: number;
  loading?: boolean;
}

export function HubStatsRow({ handicap, loyaltyPoints, loading }: HubStatsRowProps) {
  const router = useRouter();
  const t = useTranslations();

  return (
    <Animated.View
      entering={FadeInDown.delay(150).duration(600)}
      className="mx-5 mt-3 flex-row gap-3"
    >
      <StatPill
        icon={Target}
        iconColor={foxColors.lime}
        label={t.handicap}
        value={handicap !== null ? handicap.toFixed(1) : '--'}
        loading={loading}
        onPress={() => router.push('/history' as never)}
      />
      <StatPill
        icon={Star}
        iconColor={foxColors.gold}
        label={t.points}
        value={loyaltyPoints.toLocaleString()}
        loading={loading}
        onPress={() => {
          // TODO: Navigate to loyalty screen
        }}
      />
    </Animated.View>
  );
}
