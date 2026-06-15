import { View } from 'react-native';
import { ClipboardList, History, Trophy, Shield } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { QuickActionTile } from '@/components/ui/QuickActionTile';
import { useTranslations } from '@/lib/language-store';
import { useMemberAuthStore } from '@/lib/member-auth-store';
import { bridgeMemberAuthToAdmin, canAccessAdminRole } from '@/lib/admin-auth-bridge';

const QUICK_ACTIONS = [
  { titleKey: 'scorecard' as const, icon: ClipboardList, route: '/(tabs)/scorecard' },
  { titleKey: 'tournaments' as const, icon: Trophy, route: '/tournaments' },
  { titleKey: 'history' as const, icon: History, route: '/history' },
];

interface HubQuickActionsProps {
  embedded?: boolean;
}

export function HubQuickActions({ embedded = false }: HubQuickActionsProps) {
  const router = useRouter();
  const t = useTranslations();
  const profile = useMemberAuthStore((s) => s.profile);
  const isAdmin = canAccessAdminRole(profile?.role);

  const handleAdminPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await bridgeMemberAuthToAdmin();
    router.push('/admin/dashboard');
  };

  return (
    <View className={embedded ? undefined : 'px-5 mt-8'}>
      <View className="gap-3">
        <View className="flex-row gap-3">
          {QUICK_ACTIONS.map((action, index) => (
            <Animated.View
              key={action.titleKey}
              entering={FadeInRight.delay(400 + index * 100).duration(500)}
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

        {isAdmin ? (
          <Animated.View entering={FadeInRight.delay(700).duration(500)}>
            <QuickActionTile
              icon={Shield}
              label={t.adminPortal}
              onPress={handleAdminPress}
              className="border-lime-700/40"
            />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}
