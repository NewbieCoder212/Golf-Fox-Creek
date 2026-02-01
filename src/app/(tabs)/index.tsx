import { useRef } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MapPin,
  Clock,
  ChevronRight,
  Sun,
  Wind,
  Droplets,
  ClipboardList,
  History,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Trophy,
  Target,
  Star,
  Play,
  Coffee,
  AlertCircle,
  Info,
  AlertTriangle,
  Bell,
  Globe,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInRight, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';

import { useWeather, getWeatherIconType } from '@/lib/useWeather';
import { TeeTimeInput } from '@/components/TeeTimeInput';
import { TeeTimeAlertMonitor } from '@/components/TeeTimeAlertMonitor';
import { useScorecardStore } from '@/lib/scorecard-store';
import { useTeeTimeAlertStore } from '@/lib/tee-time-alert-store';
import { getGMAnnouncement, getUserProfile, isSupabaseConfigured } from '@/lib/supabase';
import { useLanguageStore, useTranslations } from '@/lib/language-store';
import type { GMAnnouncement } from '@/types';

// Fallback data when API is unavailable
const FALLBACK_WEATHER = {
  temp: '--',
  condition: 'Weather Unavailable',
  wind: '--',
  humidity: '--',
};

// Mock user ID - in real app this would come from auth
const MOCK_USER_ID = 'demo-user-001';

// Triple-tap detection timeout (ms)
const TRIPLE_TAP_TIMEOUT = 500;

// Quick links keys for translation
const QUICK_LINK_KEYS = [
  { titleKey: 'bookTeeTime' as const, icon: Clock, route: '/(tabs)/teetimes' },
  { titleKey: 'scorecard' as const, icon: ClipboardList, route: '/(tabs)/scorecard' },
  { titleKey: 'history' as const, icon: History, route: '/history' },
];

// Helper to render the correct weather icon based on conditions
function WeatherIcon({ iconCode, size = 28 }: { iconCode?: string; size?: number }) {
  const iconType = iconCode ? getWeatherIconType(iconCode) : 'sun';
  const color = '#facc15';

  switch (iconType) {
    case 'cloud':
      return <Cloud size={size} color={color} />;
    case 'rain':
      return <CloudRain size={size} color={color} />;
    case 'snow':
      return <CloudSnow size={size} color={color} />;
    case 'storm':
      return <CloudLightning size={size} color={color} />;
    case 'mist':
      return <CloudFog size={size} color={color} />;
    default:
      return <Sun size={size} color={color} />;
  }
}

// Helper to get announcement icon and colors based on type
function getAnnouncementStyle(type: GMAnnouncement['type']) {
  switch (type) {
    case 'warning':
      return {
        Icon: AlertTriangle,
        bgColor: 'bg-amber-900/40',
        borderColor: 'border-amber-700/50',
        iconColor: '#fbbf24',
        textColor: 'text-amber-200',
      };
    case 'alert':
      return {
        Icon: AlertCircle,
        bgColor: 'bg-red-900/40',
        borderColor: 'border-red-700/50',
        iconColor: '#f87171',
        textColor: 'text-red-200',
      };
    default:
      return {
        Icon: Info,
        bgColor: 'bg-blue-900/40',
        borderColor: 'border-blue-700/50',
        iconColor: '#60a5fa',
        textColor: 'text-blue-200',
      };
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const { data: weather, isLoading: weatherLoading, isError: weatherError } = useWeather();
  const t = useTranslations();
  const language = useLanguageStore((s) => s.language);
  const toggleLanguage = useLanguageStore((s) => s.toggleLanguage);

  // Triple-tap detection for admin access
  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHeaderTap = () => {
    tapCountRef.current += 1;

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    if (tapCountRef.current >= 3) {
      // Triple tap detected - open admin portal
      tapCountRef.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/admin');
      return;
    }

    // Reset tap count after timeout
    tapTimeoutRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, TRIPLE_TAP_TIMEOUT);
  };

  const handleLanguageToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleLanguage();
  };

  // Scorecard state
  const isCheckedIn = useScorecardStore((s) => s.isCheckedIn);
  const isTracking = useScorecardStore((s) => s.isTracking);
  const currentHole = useScorecardStore((s) => s.currentHole);
  const showFnbPrompt = useScorecardStore((s) => s.showFnbPrompt);
  const setShowFnbPrompt = useScorecardStore((s) => s.setShowFnbPrompt);

  // Tee time state
  const teeTime = useTeeTimeAlertStore((s) => s.teeTime);
  const getMinutesUntilTeeTime = useTeeTimeAlertStore((s) => s.getMinutesUntilTeeTime);

  // User profile from Supabase
  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['userProfile', MOCK_USER_ID],
    queryFn: () => getUserProfile(MOCK_USER_ID),
    enabled: isSupabaseConfigured(),
    staleTime: 1000 * 60 * 5,
  });

  // GM Announcement
  const { data: announcement } = useQuery({
    queryKey: ['gmAnnouncement'],
    queryFn: getGMAnnouncement,
    enabled: isSupabaseConfigured(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
  });

  // Use live data or fallback
  const weatherDisplay = weather ?? FALLBACK_WEATHER;
  const showWeatherUnavailable = weatherError || (!weatherLoading && !weather);

  // Get handicap and loyalty points (with fallbacks)
  const handicap = userProfile?.handicap_index ?? null;
  const loyaltyPoints = userProfile?.loyalty_points ?? 0;

  // Minutes until tee time
  const minutesUntil = getMinutesUntilTeeTime();

  return (
    <View className="flex-1 bg-[#0c0c0c]">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* GM Announcement Banner */}
        {announcement && (
          <Animated.View entering={FadeIn.duration(400)} className="mx-5 mt-4">
            {(() => {
              const style = getAnnouncementStyle(announcement.type);
              return (
                <View className={`${style.bgColor} ${style.borderColor} border rounded-xl p-4`}>
                  <View className="flex-row items-start">
                    <style.Icon size={20} color={style.iconColor} />
                    <View className="flex-1 ml-3">
                      {announcement.title ? (
                        <Text className={`${style.textColor} font-semibold text-sm`}>
                          {announcement.title}
                        </Text>
                      ) : null}
                      <Text className={`${style.textColor} text-sm ${announcement.title ? 'mt-1' : ''}`}>
                        {announcement.message}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}
          </Animated.View>
        )}

        {/* Member Header Card */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          className="mx-5 mt-4"
        >
          <View className="bg-[#141414] rounded-2xl border border-neutral-800 overflow-hidden">
            {/* Header with gradient - Triple tap for admin access */}
            <Pressable onPress={handleHeaderTap}>
              <LinearGradient
                colors={['#1a2e1a', '#141414']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 20, paddingBottom: 16 }}
              >
                <View className="flex-row items-start justify-between">
                  <View>
                    <Text className="text-neutral-400 text-xs uppercase tracking-[0.15em]">
                      {t.memberHub}
                    </Text>
                    <Text className="text-white text-2xl font-bold mt-1">
                      {t.foxCreek}
                    </Text>
                  </View>
                  {/* Language Toggle */}
                  <Pressable
                    onPress={handleLanguageToggle}
                    className="flex-row items-center bg-neutral-800/60 rounded-full px-2.5 py-1.5 active:opacity-70"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Globe size={14} color="#a3e635" strokeWidth={2} />
                    <Text className="text-neutral-300 text-xs font-semibold ml-1.5 tracking-wide">
                      {language.toUpperCase()}
                    </Text>
                  </Pressable>
                </View>
              </LinearGradient>
            </Pressable>

            {/* Stats Row */}
            <View className="flex-row border-t border-neutral-800">
              {/* Handicap */}
              <Pressable
                className="flex-1 p-4 items-center border-r border-neutral-800 active:bg-neutral-800/30"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/history' as any);
                }}
              >
                <Target size={20} color="#a3e635" strokeWidth={1.5} />
                <Text className="text-white text-2xl font-bold mt-2">
                  {profileLoading ? (
                    <ActivityIndicator size="small" color="#a3e635" />
                  ) : handicap !== null ? (
                    handicap.toFixed(1)
                  ) : (
                    '--'
                  )}
                </Text>
                <Text className="text-neutral-500 text-xs mt-1">{t.handicap}</Text>
              </Pressable>

              {/* Loyalty Points */}
              <Pressable
                className="flex-1 p-4 items-center active:bg-neutral-800/30"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  // TODO: Navigate to loyalty screen
                }}
              >
                <Star size={20} color="#facc15" strokeWidth={1.5} />
                <Text className="text-white text-2xl font-bold mt-2">
                  {profileLoading ? (
                    <ActivityIndicator size="small" color="#facc15" />
                  ) : (
                    loyaltyPoints.toLocaleString()
                  )}
                </Text>
                <Text className="text-neutral-500 text-xs mt-1">{t.points}</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {/* Contextual Card - Dynamic based on state */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          className="mx-5 mt-4"
        >
          {/* Priority 1: Round in Progress */}
          {isTracking ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(tabs)/scorecard' as any);
              }}
              className="bg-lime-900/30 border border-lime-700/50 rounded-2xl p-4 active:opacity-80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="w-12 h-12 bg-lime-900/50 rounded-full items-center justify-center mr-4">
                    <Play size={22} color="#a3e635" fill="#a3e635" />
                  </View>
                  <View>
                    <Text className="text-lime-300 text-lg font-semibold">{t.roundInProgress}</Text>
                    <Text className="text-lime-400/70 text-sm mt-0.5">
                      {t.currentlyOnHole} {currentHole}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={22} color="#a3e635" />
              </View>
            </Pressable>
          ) : /* Priority 2: F&B Prompt at The Turn */
          showFnbPrompt ? (
            <View className="bg-amber-900/30 border border-amber-700/50 rounded-2xl p-4">
              <View className="flex-row items-center">
                <View className="w-12 h-12 bg-amber-900/50 rounded-full items-center justify-center mr-4">
                  <Coffee size={22} color="#fbbf24" />
                </View>
                <View className="flex-1">
                  <Text className="text-amber-200 text-lg font-semibold">{t.theTurn}</Text>
                  <Text className="text-amber-300/70 text-sm mt-0.5">
                    {t.turnPrompt}
                  </Text>
                </View>
              </View>
              <View className="flex-row mt-4 gap-3">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowFnbPrompt(false);
                    // TODO: Navigate to F&B menu
                  }}
                  className="flex-1 bg-amber-600 rounded-xl py-3 items-center active:opacity-80"
                >
                  <Text className="text-white font-semibold">{t.viewMenu}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowFnbPrompt(false);
                  }}
                  className="flex-1 bg-neutral-800 rounded-xl py-3 items-center active:opacity-80"
                >
                  <Text className="text-neutral-300 font-semibold">{t.noThanks}</Text>
                </Pressable>
              </View>
            </View>
          ) : /* Priority 3: Upcoming Tee Time */
          teeTime && minutesUntil !== null && minutesUntil > 0 && minutesUntil <= 60 ? (
            <View className="bg-blue-900/30 border border-blue-700/50 rounded-2xl p-4">
              <View className="flex-row items-center">
                <View className="w-12 h-12 bg-blue-900/50 rounded-full items-center justify-center mr-4">
                  <Bell size={22} color="#60a5fa" />
                </View>
                <View className="flex-1">
                  <Text className="text-blue-200 text-lg font-semibold">{t.upcomingTeeTime}</Text>
                  <Text className="text-blue-300/70 text-sm mt-0.5">
                    {minutesUntil <= 5
                      ? `${t.startingIn} ${minutesUntil} ${minutesUntil === 1 ? t.minute : t.minutes}!`
                      : `${minutesUntil} ${t.minutesUntilTeeTime}`
                    }
                  </Text>
                </View>
              </View>
            </View>
          ) : /* Priority 4: Checked In at Clubhouse */
          isCheckedIn && !isTracking ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(tabs)/scorecard' as any);
              }}
              className="bg-emerald-900/30 border border-emerald-700/50 rounded-2xl p-4 active:opacity-80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="w-12 h-12 bg-emerald-900/50 rounded-full items-center justify-center mr-4">
                    <MapPin size={22} color="#34d399" />
                  </View>
                  <View>
                    <Text className="text-emerald-200 text-lg font-semibold">{t.checkedIn}</Text>
                    <Text className="text-emerald-300/70 text-sm mt-0.5">
                      {t.readyToStart}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={22} color="#34d399" />
              </View>
            </Pressable>
          ) : /* Default: Welcome Card */
          (
            <View className="bg-[#141414] border border-neutral-800 rounded-2xl p-4">
              <View className="flex-row items-center">
                <View className="w-12 h-12 bg-neutral-900 rounded-full items-center justify-center mr-4 border border-neutral-800">
                  <Trophy size={22} color="#a3e635" strokeWidth={1.5} />
                </View>
                <View className="flex-1">
                  <Text className="text-white text-lg font-semibold">{t.welcomeTo}</Text>
                  <Text className="text-neutral-500 text-sm mt-0.5">
                    {t.setTeeTime}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Weather Card */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(600)}
          className="mx-5 mt-4"
        >
          <View className="bg-[#141414] rounded-2xl p-4 border border-neutral-800">
            <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-3">
              {t.courseConditions}
            </Text>
            {weatherLoading ? (
              <View className="flex-row items-center justify-center py-2">
                <ActivityIndicator size="small" color="#a3e635" />
                <Text className="text-neutral-500 text-sm ml-2">{t.loadingWeather}</Text>
              </View>
            ) : showWeatherUnavailable ? (
              <View className="flex-row items-center py-2">
                <CloudFog size={28} color="#525252" />
                <Text className="text-neutral-500 text-lg ml-3">{t.weatherUnavailable}</Text>
              </View>
            ) : (
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <WeatherIcon iconCode={weather?.iconCode} />
                  <Text className="text-white text-3xl font-light ml-3">{weatherDisplay.temp}°</Text>
                  <Text className="text-neutral-400 text-lg ml-2">{weatherDisplay.condition}</Text>
                </View>
                <View className="flex-row gap-5">
                  <View className="items-center">
                    <Wind size={16} color="#a3e635" />
                    <Text className="text-neutral-500 text-xs mt-1">{weatherDisplay.wind}</Text>
                  </View>
                  <View className="items-center">
                    <Droplets size={16} color="#a3e635" />
                    <Text className="text-neutral-500 text-xs mt-1">{weatherDisplay.humidity}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Tee Time Alert Input */}
        <TeeTimeInput />

        {/* Quick Links */}
        <View className="px-5 mt-8">
          <Text className="text-neutral-500 text-xs uppercase tracking-[0.15em] mb-4">{t.quickAccess}</Text>
          <View className="flex-row gap-3">
            {QUICK_LINK_KEYS.map((link, index) => (
              <Animated.View
                key={link.titleKey}
                entering={FadeInRight.delay(400 + index * 100).duration(500)}
                className="flex-1"
              >
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(link.route as any);
                  }}
                  className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 items-center active:opacity-70 active:scale-[0.98]"
                  style={{ minHeight: 100 }}
                >
                  <View className="w-12 h-12 bg-neutral-900 rounded-full items-center justify-center mb-2 border border-neutral-800">
                    <link.icon size={20} color="#a3e635" strokeWidth={1.5} />
                  </View>
                  <Text className="text-neutral-300 text-xs font-medium text-center">{t[link.titleKey]}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Pro Shop Promo */}
        <Animated.View
          entering={FadeInDown.delay(700).duration(600)}
          className="mx-5 mt-8 mb-8"
        >
          <Pressable className="overflow-hidden rounded-2xl active:opacity-90">
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80' }}
              className="w-full h-36"
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.9)']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }}
            />
            <View className="absolute bottom-4 left-4 right-4">
              <Text className="text-lime-400 text-xs font-medium uppercase tracking-[0.15em]">{t.proShop}</Text>
              <Text className="text-white text-lg font-semibold mt-1">{t.newSeasonGear}</Text>
            </View>
          </Pressable>
        </Animated.View>

        <View className="h-4" />
      </ScrollView>

      {/* Tee Time Alert Monitor (global) */}
      <TeeTimeAlertMonitor />
    </View>
  );
}
