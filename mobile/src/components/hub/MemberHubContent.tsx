import { View, ScrollView, type RefreshControlProps } from 'react-native';
import { useEffect, type ReactElement } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HubHeroWelcome } from '@/components/hub/HubHeroWelcome';
import { HubTournamentMatchCTA } from '@/components/hub/HubTournamentMatchCTA';
import { HubEventSummaryCard } from '@/components/hub/HubEventSummaryCard';
import { HubAdBanner, HubAdFeedCards } from '@/components/hub/HubAdBanner';
import {
  useAdPlacement,
} from '@/components/SponsorBanner';
import { isBannerLayout } from '@/lib/ad-placement-service';
import { useMemberAuthStore } from '@/lib/member-auth-store';
import { useAdminAuthStore } from '@/lib/admin-auth-store';
import { bridgeMemberAuthToAdmin } from '@/lib/admin-auth-bridge';
import { getUserProfile, isSupabaseConfigured, signOut } from '@/lib/supabase';
import { useTournamentStore } from '@/lib/tournament-store';
import { isTournamentActiveToday } from '@/lib/tournament-scorecard-routing';
import { getTournamentsForUserList } from '@/lib/tournament-service';
import type { UserProfile } from '@/types';

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

  const authUser = useMemberAuthStore((s) => s.user);
  const authProfile = useMemberAuthStore((s) => s.profile);
  const accessToken = useMemberAuthStore((s) => s.accessToken);
  const clearAuth = useMemberAuthStore((s) => s.clearAuth);

  const adminUser = useAdminAuthStore((s) => s.user);
  const adminProfile = useAdminAuthStore((s) => s.profile);

  const userId = userIdProp ?? authUser?.id ?? adminUser?.id;
  const resolvedProfile = userProfileProp ?? authProfile ?? adminProfile;

  const { data: myEvents = [] } = useQuery({
    queryKey: ['hubMyEvents', userId],
    queryFn: () => getTournamentsForUserList(userId!, { limit: 3 }),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
  });

  const primaryTournament = myEvents[0] ?? null;

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

  const handleLogout = async () => {
    if (previewMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (accessToken) {
      await signOut(accessToken);
    }
    await useTournamentStore.getState().clearPersistedSession();
    await clearAuth();
    router.replace('/login');
  };

  const { data: memberHubAds = [] } = useAdPlacement('member_hub');
  const hasStickyFooterAd = memberHubAds.some(isBannerLayout);

  const topPadding = contentPaddingTop ?? (previewMode ? 0 : insets.top);

  const isEventDay = primaryTournament
    ? isTournamentActiveToday(primaryTournament.start_date, primaryTournament.end_date)
    : false;

  const showEventSummary =
    !previewMode && (myEvents.length === 0 || (primaryTournament != null && !isEventDay));

  const hubScrollContent = (
    <>
      <HubHeroWelcome
        userProfile={userProfile}
        previewMode={previewMode}
        onLogout={previewMode ? undefined : handleLogout}
        layout="fixed"
      />

      <View className="shrink-0">
        {!previewMode ? (
          <HubTournamentMatchCTA
            userId={userId}
            primaryTournament={primaryTournament}
            compact
          />
        ) : null}

        {showEventSummary ? (
          <HubEventSummaryCard
            tournament={primaryTournament}
            showNoEventAssigned={myEvents.length === 0}
            compact
          />
        ) : null}
      </View>

      <HubAdFeedCards />
    </>
  );

  return (
    <View className="flex-1 bg-fox-background" style={{ width: '100%' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEnabled={!previewMode}
        className="flex-1"
        style={{ width: '100%' }}
        refreshControl={previewMode ? refreshControl : undefined}
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: hasStickyFooterAd ? 8 : Math.max(insets.bottom, 16),
        }}
      >
        {hubScrollContent}
      </ScrollView>

      {hasStickyFooterAd ? (
        <View
          className="bg-fox-background border-t border-fox-border/30 pt-2"
          style={{ paddingBottom: Math.max(insets.bottom, 8) }}
        >
          <HubAdBanner embedded />
        </View>
      ) : null}
    </View>
  );
}
