import { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Globe, LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useTranslations, useLanguageStore } from '@/lib/language-store';
import { getFirstName, getGreetingKey, foxColors } from '@/theme/tokens';
import { bridgeMemberAuthToAdmin, canAccessAdminRole } from '@/lib/admin-auth-bridge';
import { useMemberAuthStore } from '@/lib/member-auth-store';
import type { UserProfile } from '@/types';

const TRIPLE_TAP_TIMEOUT = 500;
const COURSE_HERO_IMAGE = require('@/assets/images/fox-creek-hero-banner.png');
const HERO_BANNER_ASPECT = 512 / 768;
const HERO_MAX_HEIGHT = 380;

interface HubHeroWelcomeProps {
  userProfile: UserProfile | null | undefined;
  onLogout: () => void;
}

function getHeroHeight(containerWidth: number, windowHeight: number): number {
  if (containerWidth <= 0) return 260;

  const aspectHeight = Math.round(containerWidth * HERO_BANNER_ASPECT);
  const heightBased = Math.round(windowHeight * 0.36);

  return Math.min(aspectHeight, heightBased, HERO_MAX_HEIGHT);
}

export function HubHeroWelcome({ userProfile, onLogout }: HubHeroWelcomeProps) {
  const router = useRouter();
  const t = useTranslations();
  const { height: windowHeight } = useWindowDimensions();
  const language = useLanguageStore((s) => s.language);
  const toggleLanguage = useLanguageStore((s) => s.toggleLanguage);
  const [containerWidth, setContainerWidth] = useState(0);

  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const heroHeight = getHeroHeight(containerWidth, windowHeight);

  const greetingKey = getGreetingKey();
  const firstName = getFirstName(userProfile?.full_name);
  const greeting = firstName ? `${t[greetingKey]}, ${firstName}` : t[greetingKey];

  const memberProfile = useMemberAuthStore((s) => s.profile);

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
    }
  };

  const handleHeaderTap = async () => {
    tapCountRef.current += 1;

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (canAccessAdminRole(memberProfile?.role)) {
        await bridgeMemberAuthToAdmin();
        router.push('/admin/dashboard');
      } else {
        router.push('/admin');
      }
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
    <Animated.View
      entering={FadeInDown.delay(100).duration(600)}
      onLayout={handleLayout}
      style={{ width: '100%', height: heroHeight, overflow: 'hidden' }}
    >
      <Image
        source={COURSE_HERO_IMAGE}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
        resizeMode="cover"
      />
      <LinearGradient
        colors={[
          'rgba(10,10,10,0.35)',
          'rgba(10,10,10,0.05)',
          'rgba(10,10,10,0.45)',
          'rgba(10,10,10,0.92)',
        ]}
        locations={[0, 0.3, 0.65, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />

      <View className="flex-1 px-5 pt-3 pb-5 justify-between">
        <View className="flex-row items-center justify-end gap-2">
          <Pressable
            onPress={handleLanguageToggle}
            className="flex-row items-center bg-black/40 rounded-full px-2.5 py-1.5 border border-white/10 active:opacity-70"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Globe size={14} color={foxColors.lime} strokeWidth={2} />
            <Text className="text-neutral-200 text-xs font-body-semibold ml-1.5 tracking-wide">
              {language.toUpperCase()}
            </Text>
          </Pressable>
          <Pressable
            onPress={onLogout}
            className="w-9 h-9 bg-black/40 rounded-full items-center justify-center border border-white/10 active:opacity-70"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Sign out"
          >
            <LogOut size={16} color={foxColors.danger} strokeWidth={2} />
          </Pressable>
        </View>

        <View className="flex-1" />

        <Pressable onPress={handleHeaderTap}>
          <Text className="text-white text-3xl font-display">{greeting}</Text>
          <Text className="text-neutral-300 text-xs uppercase tracking-[0.2em] font-body-semibold mt-1.5">
            {t.foxCreek} · {t.homeCourseTagline}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
