import { View, Text, ScrollView } from 'react-native';
import { useEffect } from 'react';
import { AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HubHeader } from '@/components/hub/HubHeader';
import { HubStatsRow } from '@/components/hub/HubStatsRow';
import { HubContextCard } from '@/components/hub/HubContextCard';
import { HubMyEventsStrip } from '@/components/hub/HubMyEventsStrip';
import { HubWeatherStrip } from '@/components/hub/HubWeatherStrip';
import { HubQuickActions } from '@/components/hub/HubQuickActions';
import { HubPromoBanner } from '@/components/hub/HubPromoBanner';
import { TeeTimeInput } from '@/components/TeeTimeInput';
import { TeeTimeAlertMonitor } from '@/components/TeeTimeAlertMonitor';
import { GeofenceMonitor } from '@/components/GeofenceMonitor';
import { useWeather } from '@/lib/useWeather';
import { useMemberAuthStore } from '@/lib/member-auth-store';
import { bridgeMemberAuthToAdmin } from '@/lib/admin-auth-bridge';
import { getGMAnnouncement, getUserProfile, isSupabaseConfigured, signOut } from '@/lib/supabase';
import type { GMAnnouncement } from '@/types';

const FALLBACK_WEATHER = {
  temp: '--',
  condition: 'Weather Unavailable',
  wind: '--',
  humidity: '--',
};

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
  const insets = useSafeAreaInsets();
  const { data: weather, isLoading: weatherLoading, isError: weatherError } = useWeather();

  const authUser = useMemberAuthStore((s) => s.user);
  const authProfile = useMemberAuthStore((s) => s.profile);
  const accessToken = useMemberAuthStore((s) => s.accessToken);
  const clearAuth = useMemberAuthStore((s) => s.clearAuth);
  const userId = authUser?.id;

  useEffect(() => {
    bridgeMemberAuthToAdmin();
  }, [userId, authProfile?.role]);

  const { data: fetchedProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => getUserProfile(userId!),
    enabled: isSupabaseConfigured() && !!userId && !authProfile,
    staleTime: 1000 * 60 * 5,
  });

  const userProfile = authProfile ?? fetchedProfile;

  const { data: announcement } = useQuery({
    queryKey: ['gmAnnouncement'],
    queryFn: getGMAnnouncement,
    enabled: isSupabaseConfigured(),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
  });

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (accessToken) {
      await signOut(accessToken);
    }
    await clearAuth();
    router.replace('/login');
  };

  const weatherDisplay = weather
    ? {
        temp: String(Math.round(weather.temp)),
        condition: weather.condition,
        wind: weather.wind,
        humidity: weather.humidity,
      }
    : FALLBACK_WEATHER;
  const showWeatherUnavailable = weatherError || (!weatherLoading && !weather);
  const handicap = userProfile?.handicap_index ?? null;
  const loyaltyPoints = userProfile?.loyalty_points ?? 0;

  return (
    <View className="flex-1 bg-fox-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top }}
      >
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
                        <Text className={`${style.textColor} font-body-semibold text-sm`}>
                          {announcement.title}
                        </Text>
                      ) : null}
                      <Text
                        className={`${style.textColor} text-sm font-body ${announcement.title ? 'mt-1' : ''}`}
                      >
                        {announcement.message}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}
          </Animated.View>
        )}

        <HubHeader userProfile={userProfile} onLogout={handleLogout} />
        <HubStatsRow
          handicap={handicap}
          loyaltyPoints={loyaltyPoints}
          loading={profileLoading}
        />
        <HubContextCard />
        <HubMyEventsStrip userId={userId} />
        <HubWeatherStrip
          weather={weatherDisplay}
          iconCode={weather?.iconCode}
          loading={weatherLoading}
          unavailable={showWeatherUnavailable}
        />
        <TeeTimeInput />
        <HubQuickActions />
        <HubPromoBanner />

        <View className="h-4" />
      </ScrollView>

      <TeeTimeAlertMonitor />
      <GeofenceMonitor />
    </View>
  );
}
