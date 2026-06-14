import { View, Text, Pressable } from 'react-native';
import {
  ChevronRight,
  Play,
  Coffee,
  Bell,
  MapPin,
  Trophy,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SponsorBanner } from '@/components/SponsorBanner';
import { useTranslations } from '@/lib/language-store';
import { useScorecardStore } from '@/lib/scorecard-store';
import { useTeeTimeAlertStore } from '@/lib/tee-time-alert-store';
import { foxColors } from '@/theme/tokens';

export function HubContextCard() {
  const router = useRouter();
  const t = useTranslations();

  const isCheckedIn = useScorecardStore((s) => s.isCheckedIn);
  const isTracking = useScorecardStore((s) => s.isTracking);
  const currentHole = useScorecardStore((s) => s.currentHole);
  const showFnbPrompt = useScorecardStore((s) => s.showFnbPrompt);
  const setShowFnbPrompt = useScorecardStore((s) => s.setShowFnbPrompt);

  const teeTime = useTeeTimeAlertStore((s) => s.teeTime);
  const getMinutesUntilTeeTime = useTeeTimeAlertStore((s) => s.getMinutesUntilTeeTime);
  const minutesUntil = getMinutesUntilTeeTime();

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(600)}>
      {isTracking ? (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/(tabs)/scorecard' as never);
          }}
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
      ) : showFnbPrompt ? (
        <SurfaceCard className="p-4 bg-amber-950/30 border-amber-700/50">
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-amber-900/50 rounded-full items-center justify-center mr-4">
              <Coffee size={22} color="#fbbf24" />
            </View>
            <View className="flex-1">
              <Text className="text-amber-200 text-lg font-display">{t.theTurn}</Text>
              <Text className="text-amber-300/70 text-sm mt-0.5 font-body">{t.turnPrompt}</Text>
            </View>
          </View>
          <View className="mt-4">
            <SponsorBanner placementType="the_turn" />
          </View>
          <View className="flex-row mt-4 gap-3">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowFnbPrompt(false);
              }}
              className="flex-1 bg-amber-600 rounded-xl py-3 items-center active:opacity-80"
            >
              <Text className="text-white font-body-semibold">{t.viewMenu}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowFnbPrompt(false);
              }}
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
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/(tabs)/scorecard' as never);
          }}
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
      ) : (
        <View>
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-fox-surface-elevated rounded-full items-center justify-center mr-4 border border-fox-border">
              <Trophy size={22} color={foxColors.lime} strokeWidth={1.5} />
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-display">{t.welcomeTo}</Text>
              <Text className="text-neutral-500 text-sm mt-0.5 font-body">{t.setTeeTime}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(tabs)/teetimes' as never);
            }}
            className="mt-4 bg-fox-lime rounded-xl py-3 items-center active:opacity-80"
          >
            <Text className="text-black font-body-bold">{t.bookTeeTimeCta}</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}
