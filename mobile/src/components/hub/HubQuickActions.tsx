import { View } from 'react-native';
import { Clock, ClipboardList, History, Trophy } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { SectionLabel } from '@/components/ui/SectionLabel';
import { QuickActionTile } from '@/components/ui/QuickActionTile';
import { useTranslations } from '@/lib/language-store';

const QUICK_ACTIONS = [
  { titleKey: 'bookTeeTime' as const, icon: Clock, route: '/(tabs)/teetimes' },
  { titleKey: 'scorecard' as const, icon: ClipboardList, route: '/(tabs)/scorecard' },
  { titleKey: 'history' as const, icon: History, route: '/history' },
  { titleKey: 'tournaments' as const, icon: Trophy, route: '/tournaments' },
];

export function HubQuickActions() {
  const router = useRouter();
  const t = useTranslations();

  const rows = [
    QUICK_ACTIONS.slice(0, 2),
    QUICK_ACTIONS.slice(2, 4),
  ];

  return (
    <View className="px-5 mt-8">
      <SectionLabel label={t.quickPlay} />
      <View className="gap-3">
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row gap-3">
            {row.map((action, index) => (
              <Animated.View
                key={action.titleKey}
                entering={FadeInRight.delay(400 + (rowIndex * 2 + index) * 100).duration(500)}
                className="flex-1"
              >
                <QuickActionTile
                  icon={action.icon}
                  label={t[action.titleKey]}
                  onPress={() => router.push(action.route as never)}
                />
              </Animated.View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
