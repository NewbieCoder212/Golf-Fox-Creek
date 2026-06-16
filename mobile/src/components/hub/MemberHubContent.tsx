import { View, Text, ScrollView, type RefreshControlProps } from 'react-native';
import { useEffect, useCallback, type ReactElement } from 'react';
import { AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HubHeroWelcome } from '@/components/hub/HubHeroWelcome';
import { HubContextCard } from '@/components/hub/HubContextCard';
import { HubMyEventsStrip } from '@/components/hub/HubMyEventsStrip';
import { HubAdBanner } from '@/components/hub/HubAdBanner';
import {
  COMPACT_SPONSOR_BANNER_HEIGHT,
  STICKY_FOOTER_AD_EXTRA,
  useAdPlacement,
} from '@/components/SponsorBanner';
import { TournamentLeaderboardCard } from '@/components/TournamentLeaderboardCard';
import { HubWeatherStrip } from '@/components/hub/HubWeatherStrip';
import { HubQuickActions } from '@/components/hub/HubQuickActions';
import { HubSection } from '@/components/ui/HubSection';
import { useWeather } from '@/lib/useWeather';
import { useMemberAuthStore } from '@/lib/member-auth-store';
import { useAdminAuthStore } from '@/lib/admin-auth-store';
import { bridgeMemberAuthToAdmin } from '@/lib/admin-auth-bridge';
import { getGMAnnouncement, getUserProfile, isSupabaseConfigured, signOut } from '@/lib/supabase';
import { useTranslations } from '@/lib/language-store';
import { useScorecardStore } from '@/lib/scorecard-store';
import { getTournamentsForUserList } from '@/lib/tournament-service';
import type { GMAnnouncement, UserProfile } from '@/types';

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

export interface MemberHubContentProps {
  previewMode?: boolean;
  userId?: string;
  userProfile?: UserProfile | null;
  contentPaddingTop?: number;
  refreshControl?: ReactElement<RefreshControlProps>;
}

export function MemberHubContent({
  previewMode = false,
  userId: userIdProp,
  userProfile: userProfileProp,
  contentPaddingTop,
  refreshControl,
}: MemberHubContentProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslations();
  const { data: weather, isLoading: weatherLoading, isError: weatherError } = useWeather();

  const authUser = useMemberAuthStore((s) => s.user);
  const authProfile = useMemberAuthStore((s) => s.profile);
  const accessToken = useMemberAuthStore((s) => s.accessToken);
  const clearAuth = useMemberAuthStore((s) => s.clearAuth);

  const adminUser = useAdminAuthStore((s) => s.user);
  const adminProfile = useAdminAuthStore((s) => s.profile);

  const userId = userIdProp ?? authUser?.id ?? adminUser?.id;
  const resolvedProfile = userProfileProp ?? authProfile ?? adminProfile;

  const refreshUnfinishedRoundStatus = useScorecardStore((s) => s.refreshUnfinishedRoundStatus);

  const { data: activeTournaments = [] } = useQuery({
    queryKey: ['hubLeaderboardTournament', userId],
    queryFn: () => getTournamentsForUserList(userId!, { limit: 1 }),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
  });

  const leaderboardTournamentId = activeTournaments[0]?.id;

  useFocusEffect(
    useCallback(() => {
      if (!previewMode) {
        refreshUnfinishedRoundStatus();
      }
    }, [refreshUnfinishedRoundStatus, previewMode])
  );

  useEffect(() => {
    if (!previewMode) {
      bridgeMemberAuthToAdmin();
    }
  }, [userId, resolvedProfile?.role, previewMode]);

  const { data: fetchedProfile } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => getUserProfile(userId!),
    enabled: isSupabaseConfigured() && !!userId && !resolvedProfile,
    staleTime: 1000 * 60 * 5,
  });

  const userProfile = resolvedProfile ?? fetchedProfile;

  const { data: announcement } = useQuery({
    queryKey: ['gmAnnouncement'],
    queryFn: getGMAnnouncement,
    enabled: isSupabaseConfigured(),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: !previewMode,
  });

  const handleLogout = async () => {
    if (previewMode) return;
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

  const { data: memberHubAds = [] } = useAdPlacement('member_hub');
  const hasStickyFooterAd = memberHubAds.length > 0;
  const stickyFooterHeight = hasStickyFooterAd
    ? COMPACT_SPONSOR_BANNER_HEIGHT + STICKY_FOOTER_AD_EXTRA
    : 0;

  const topPadding = contentPaddingTop ?? insets.top;

  const handleMyEventsAction = () => {
    if (previewMode) return;
    router.push('/tournaments' as never);
  };

  return (
    <View className="flex-1 bg-fox-background" style={{ width: '100%' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        style={{ width: '100%' }}
        refreshControl={refreshControl}
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: stickyFooterHeight + 16,
        }}
      >
        {announcement ? (
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
        ) : null}

        <HubHeroWelcome
          userProfile={userProfile}
          onLogout={handleLogout}
          previewMode={previewMode}
        />

        <HubSection title={t.yourRound} className="mt-4">
          <HubContextCard />
          <HubWeatherStrip
            weather={weatherDisplay}
            iconCode={weather?.iconCode}
            loading={weatherLoading}
            unavailable={showWeatherUnavailable}
            embedded
          />
        </HubSection>

        <HubSection
          title={t.myEvents}
          actionLabel={t.viewAll}
          onActionPress={handleMyEventsAction}
        >
          <HubMyEventsStrip userId={userId} embedded />
        </HubSection>

        {leaderboardTournamentId ? (
          <HubSection title="Tournament Standings">
            <TournamentLeaderboardCard tournamentId={leaderboardTournamentId} compact />
          </HubSection>
        ) : null}

        <HubSection title={t.play}>
          <HubQuickActions embedded previewMode={previewMode} userProfile={userProfile} />
        </HubSection>
      </ScrollView>

      {hasStickyFooterAd ? (
        <View className="bg-fox-background border-t border-fox-border/60 pt-2">
          <HubAdBanner embedded />
        </View>
      ) : null}
    </View>
  );
}
