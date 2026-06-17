import { useRef, useState } from 'react';
import { View, Text, Pressable, Image, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LogOut } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useTranslations } from '@/lib/language-store';
import { cn } from '@/lib/cn';
import { getFirstName, getGreetingKey } from '@/theme/tokens';
import { bridgeMemberAuthToAdmin, canAccessAdminRole } from '@/lib/admin-auth-bridge';
import { useMemberAuthStore } from '@/lib/member-auth-store';
import type { UserProfile } from '@/types';

const TRIPLE_TAP_TIMEOUT = 500;
const COURSE_HERO_IMAGE = require('@/assets/images/fox-creek-hero-banner.png');
const HERO_BANNER_ASPECT = 512 / 768;
const HERO_MAX_HEIGHT = 380;

interface HubHeroWelcomeProps {
  userProfile: UserProfile | null | undefined;
  previewMode?: boolean;
  onLogout?: () => void;
  layout?: 'fixed' | 'flex';
}

function getHeroHeight(containerWidth: number, windowHeight: number, layout: 'fixed' | 'flex'): number {
  if (layout === 'flex') {
    return Math.min(Math.round(windowHeight * 0.28), 240);
  }

  if (containerWidth <= 0) return 260;

  const aspectHeight = Math.round(containerWidth * HERO_BANNER_ASPECT);
  const heightBased = Math.round(windowHeight * 0.36);

  return Math.min(aspectHeight, heightBased, HERO_MAX_HEIGHT);
}

export function HubHeroWelcome({
  userProfile,
  previewMode = false,
  onLogout,
  layout = 'fixed',
}: HubHeroWelcomeProps) {
  const router = useRouter();
  const t = useTranslations();
  const { height: windowHeight } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);

  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const heroHeight = getHeroHeight(containerWidth, windowHeight, layout);
  const isFlexLayout = layout === 'flex';

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
    if (previewMode) return;

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

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLogout?.();
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(600)}
      onLayout={handleLayout}
      style={
        isFlexLayout
          ? { width: '100%', flex: 1, minHeight: 132, maxHeight: 240, overflow: 'hidden' }
          : { width: '100%', height: heroHeight, overflow: 'hidden' }
      }
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

      {onLogout ? (
        <View className="absolute top-3 right-5 z-10">
          <Pressable
            onPress={handleLogout}
            className="w-10 h-10 items-center justify-center rounded-full bg-black/40 border border-white/20 active:opacity-70"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t.logOut}
          >
            <LogOut size={18} color="#ffffff" strokeWidth={2} />
          </Pressable>
        </View>
      ) : null}

      <View className={cn('flex-1 px-5 justify-end', isFlexLayout ? 'pb-3' : 'pb-5')}>
        <Pressable onPress={handleHeaderTap}>
          <Text className={cn('text-white font-display', isFlexLayout ? 'text-2xl' : 'text-3xl')}>
            {greeting}
          </Text>
          <Text
            className={cn(
              'text-neutral-300 uppercase tracking-[0.2em] font-body-semibold mt-1.5',
              isFlexLayout ? 'text-[10px]' : 'text-xs'
            )}
          >
            {t.homeCourseTagline}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
