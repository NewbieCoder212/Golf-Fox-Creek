import { useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Globe, LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useTranslations, useLanguageStore } from '@/lib/language-store';
import { getFirstName, getGreetingKey, foxColors } from '@/theme/tokens';
import type { UserProfile } from '@/types';

const TRIPLE_TAP_TIMEOUT = 500;

interface HubHeaderProps {
  userProfile: UserProfile | null | undefined;
  onLogout: () => void;
}

export function HubHeader({ userProfile, onLogout }: HubHeaderProps) {
  const router = useRouter();
  const t = useTranslations();
  const language = useLanguageStore((s) => s.language);
  const toggleLanguage = useLanguageStore((s) => s.toggleLanguage);

  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const greetingKey = getGreetingKey();
  const firstName = getFirstName(userProfile?.full_name);
  const greeting = firstName
    ? `${t[greetingKey]}, ${firstName}`
    : t[greetingKey];

  const handleHeaderTap = () => {
    tapCountRef.current += 1;

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/admin');
      return;
    }

    tapTimeoutRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, TRIPLE_TAP_TIMEOUT);
  };

  const handleLanguageToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleLanguage();
  };

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(600)} className="mx-5 mt-4">
      <SurfaceCard variant="accent" className="overflow-hidden">
        <View className="h-1 bg-fox-lime" />
        <Pressable onPress={handleHeaderTap}>
          <View className="p-5 pb-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-white text-2xl font-display">{greeting}</Text>
                <Text className="text-neutral-500 text-xs uppercase tracking-[0.2em] font-body-semibold mt-2">
                  {t.foxCreek} · {t.memberHub}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={handleLanguageToggle}
                  className="flex-row items-center bg-fox-surface-elevated rounded-full px-2.5 py-1.5 border border-fox-border active:opacity-70"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Globe size={14} color={foxColors.lime} strokeWidth={2} />
                  <Text className="text-neutral-300 text-xs font-body-semibold ml-1.5 tracking-wide">
                    {language.toUpperCase()}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onLogout}
                  className="w-9 h-9 bg-fox-surface-elevated rounded-full items-center justify-center border border-fox-border active:opacity-70"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="Sign out"
                >
                  <LogOut size={16} color={foxColors.danger} strokeWidth={2} />
                </Pressable>
              </View>
            </View>
          </View>
        </Pressable>
      </SurfaceCard>
    </Animated.View>
  );
}
