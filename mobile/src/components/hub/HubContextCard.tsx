import { View, Text, Pressable } from 'react-native';
import {
  ChevronRight,
  Play,
  Coffee,
  Bell,
  MapPin,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';

import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SponsorBanner } from '@/components/SponsorBanner';
import { useTranslations } from '@/lib/language-store';
import { useScorecardStore } from '@/lib/scorecard-store';
import { useTeeTimeAlertStore } from '@/lib/tee-time-alert-store';
import { getTurnMessaging, getDefaultTurnMessagingSettings } from '@/lib/supabase';
import { foxColors } from '@/theme/tokens';
import {
  getScenarioOverrides,
  useHubPreviewContext,
} from '@/components/hub/HubPreviewContext';

export function useHubRoundContext() {
  const previewContext = useHubPreviewContext();

  const storeIsCheckedIn = useScorecardStore((s) => s.isCheckedIn);
  const storeIsTracking = useScorecardStore((s) => s.isTracking);
  const storeIsTurnPaused = useScorecardStore((s) => s.isTurnPaused);
  const storeHasUnfinishedRound = useScorecardStore((s) => s.hasUnfinishedRound);
  const storeCurrentHole = useScorecardStore((s) => s.currentHole);
  const storeShowFnbPrompt = useScorecardStore((s) => s.showFnbPrompt);

  const storeTeeTime = useTeeTimeAlertStore((s) => s.teeTime);
  const getMinutesUntilTeeTime = useTeeTimeAlertStore((s) => s.getMinutesUntilTeeTime);
  const storeMinutesUntil = getMinutesUntilTeeTime();

  const scenarioOverrides =
    previewContext?.previewMode && previewContext.scenario !== 'live'
      ? getScenarioOverrides(previewContext.scenario)
      : null;

  const isCheckedIn = scenarioOverrides?.isCheckedIn ?? storeIsCheckedIn;
  const isTracking = scenarioOverrides?.isTracking ?? storeIsTracking;
  const isTurnPaused = scenarioOverrides?.isTurnPaused ?? storeIsTurnPaused;
  const hasUnfinishedRound = scenarioOverrides?.hasUnfinishedRound ?? storeHasUnfinishedRound;
  const currentHole = scenarioOverrides?.currentHole ?? storeCurrentHole;
  const showFnbPrompt = scenarioOverrides?.showFnbPrompt ?? storeShowFnbPrompt;
  const teeTime = scenarioOverrides?.teeTime ?? storeTeeTime;
  const minutesUntil = scenarioOverrides?.minutesUntil ?? storeMinutesUntil;

  const hasUpcomingTeeTime =
    teeTime !== null && minutesUntil !== null && minutesUntil > 0 && minutesUntil <= 60;

  const hasActiveContext =
    isTracking ||
    hasUnfinishedRound ||
    isTurnPaused ||
    showFnbPrompt ||
    hasUpcomingTeeTime ||
    (isCheckedIn && !isTracking);

  return {
    isPreview: previewContext?.previewMode ?? false,
    isCheckedIn,
    isTracking,
    isTurnPaused,
    hasUnfinishedRound,
    currentHole,
    showFnbPrompt,
    teeTime,
    minutesUntil,
    hasActiveContext,
  };
}

export function HubContextCard() {
  const router = useRouter();
  const t = useTranslations();

  const { data: turnMessaging = getDefaultTurnMessagingSettings() } = useQuery({
    queryKey: ['turnMessaging'],
    queryFn: getTurnMessaging,
    staleTime: 1000 * 60 * 5,
  });

  const hubTurnTitle = turnMessaging.hub_title || t.theTurn;
  const hubTurnPrompt = turnMessaging.hub_prompt || t.turnPrompt;

  const resumeRound = useScorecardStore((s) => s.resumeRound);
  const hasRoundProgress = useScorecardStore((s) => s.hasRoundProgress);
  const setShowFnbPrompt = useScorecardStore((s) => s.setShowFnbPrompt);

  const {
    isPreview,
    isCheckedIn,
    isTracking,
    isTurnPaused,
    hasUnfinishedRound,
    currentHole,
    showFnbPrompt,
    teeTime,
    minutesUntil,
    hasActiveContext,
  } = useHubRoundContext();

  const goToScorecard = async () => {
    if (isPreview) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!hasRoundProgress()) {
      await resumeRound();
    }
    router.push('/(tabs)/scorecard' as never);
  };

  const handleNavigate = (route: string) => {
    if (isPreview) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(route as never);
  };

  const handleDismissFnb = () => {
    if (isPreview) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFnbPrompt(false);
  };

  if (!hasActiveContext) {
    return null;
  }

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(600)}>
      {isTracking ? (
        <Pressable
          onPress={goToScorecard}
          className="active:opacity-80 active:scale-[0.99]"
        >
          <SurfaceCard variant="live" className="p-4 pl-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 bg-fox-lime-muted/40 rounded-full items-center justify-center mr-4 border border-fox-border-accent">
                  <Play size={22} color={foxColors.lime} fill={foxColors.lime} />
                </View>
                <View>
                  <Text className="text-fox-lime text-lg font-display">{t.roundInProgress}</Text>
                  <Text className="text-lime-400/70 text-sm mt-0.5 font-body">
                    {t.currentlyOnHole} {currentHole}
                  </Text>
                </View>
              </View>
              <ChevronRight size={22} color={foxColors.lime} />
            </View>
          </SurfaceCard>
        </Pressable>
      ) : (hasUnfinishedRound || isTurnPaused) ? (
        <Pressable
          onPress={goToScorecard}
          className="active:opacity-80 active:scale-[0.99]"
        >
          <SurfaceCard variant="live" className="p-4 pl-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 bg-fox-lime-muted/40 rounded-full items-center justify-center mr-4 border border-fox-border-accent">
                  <Play size={22} color={foxColors.lime} fill={foxColors.lime} />
                </View>
                <View>
                  <Text className="text-fox-lime text-lg font-display">{t.continueRound}</Text>
                  <Text className="text-lime-400/70 text-sm mt-0.5 font-body">
                    {isTurnPaused
                      ? hubTurnTitle
                      : `${t.currentlyOnHole} ${currentHole}`}
                  </Text>
                </View>
              </View>
              <ChevronRight size={22} color={foxColors.lime} />
            </View>
          </SurfaceCard>
        </Pressable>
      ) : showFnbPrompt ? (
        <SurfaceCard className="p-4 bg-amber-950/30 border-amber-700/50">
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-amber-900/50 rounded-full items-center justify-center mr-4">
              <Coffee size={22} color="#fbbf24" />
            </View>
            <View className="flex-1">
              <Text className="text-amber-200 text-lg font-display">{hubTurnTitle}</Text>
              <Text className="text-amber-300/70 text-sm mt-0.5 font-body">{hubTurnPrompt}</Text>
            </View>
          </View>
          <View className="mt-4">
            <SponsorBanner placementType="the_turn" />
          </View>
          <View className="flex-row mt-4 gap-3">
            <Pressable
              onPress={handleDismissFnb}
              className="flex-1 bg-amber-600 rounded-xl py-3 items-center active:opacity-80"
            >
              <Text className="text-white font-body-semibold">{t.viewMenu}</Text>
            </Pressable>
            <Pressable
              onPress={handleDismissFnb}
              className="flex-1 bg-fox-surface-elevated rounded-xl py-3 items-center active:opacity-80 border border-fox-border"
            >
              <Text className="text-neutral-300 font-body-semibold">{t.noThanks}</Text>
            </Pressable>
          </View>
        </SurfaceCard>
      ) : teeTime && minutesUntil !== null && minutesUntil > 0 && minutesUntil <= 60 ? (
        <SurfaceCard className="p-4 bg-blue-950/30 border-blue-700/50">
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-blue-900/50 rounded-full items-center justify-center mr-4">
              <Bell size={22} color="#60a5fa" />
            </View>
            <View className="flex-1">
              <Text className="text-blue-200 text-lg font-display">{t.upcomingTeeTime}</Text>
              <Text className="text-blue-300/70 text-sm mt-0.5 font-body">
                {minutesUntil <= 5
                  ? `${t.startingIn} ${minutesUntil} ${minutesUntil === 1 ? t.minute : t.minutes}!`
                  : `${minutesUntil} ${t.minutesUntilTeeTime}`}
              </Text>
            </View>
          </View>
        </SurfaceCard>
      ) : isCheckedIn && !isTracking ? (
        <Pressable
          onPress={() => handleNavigate('/(tabs)/scorecard')}
          className="active:opacity-80 active:scale-[0.99]"
        >
          <SurfaceCard variant="accent" className="p-4 pl-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 bg-emerald-900/50 rounded-full items-center justify-center mr-4">
                  <MapPin size={22} color="#34d399" />
                </View>
                <View>
                  <Text className="text-emerald-200 text-lg font-display">{t.checkedIn}</Text>
                  <Text className="text-emerald-300/70 text-sm mt-0.5 font-body">{t.readyToStart}</Text>
                </View>
              </View>
              <ChevronRight size={22} color="#34d399" />
            </View>
          </SurfaceCard>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
