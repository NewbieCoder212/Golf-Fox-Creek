import { View, Text, Pressable, Image, Platform, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { cn } from '@/lib/cn';
import {
  getActiveAdPlacement,
  getActiveAdPlacements,
  isAdPlacementServiceConfigured,
} from '@/lib/ad-placement-service';
import type { AdDisplayPosition, AdPlacementType } from '@/types';

export const COMPACT_SPONSOR_BANNER_HEIGHT = 96;
export const STICKY_FOOTER_AD_EXTRA = 20;

interface UseAdPlacementOptions {
  holeNumber?: number;
  displayPosition?: AdDisplayPosition;
}

export function useAdPlacement(
  placementType: AdPlacementType | string,
  options?: UseAdPlacementOptions
) {
  const useMulti =
    placementType === 'leaderboard' && options?.displayPosition != null;

  return useQuery({
    queryKey: [
      'adPlacement',
      placementType,
      options?.holeNumber ?? null,
      options?.displayPosition ?? null,
      useMulti,
    ],
    queryFn: () =>
      useMulti
        ? getActiveAdPlacements(placementType, {
            displayPosition: options!.displayPosition,
            limit: 1,
          })
        : getActiveAdPlacement(placementType, options?.holeNumber).then((ad) =>
            ad ? [ad] : []
          ),
    enabled: isAdPlacementServiceConfigured(),
    staleTime: 1000 * 60 * 5,
  });
}

interface SponsorBannerProps {
  placementType: AdPlacementType | string;
  holeNumber?: number;
  displayPosition?: AdDisplayPosition;
  className?: string;
  compact?: boolean;
}

function openActionUrl(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  Linking.openURL(url);
}

export function SponsorBanner({
  placementType,
  holeNumber,
  displayPosition,
  className,
  compact = false,
}: SponsorBannerProps) {
  const { data: ads = [] } = useAdPlacement(placementType, { holeNumber, displayPosition });

  const ad = ads[0];

  if (!ad) {
    return null;
  }

  const imageHeight = compact ? 96 : 140;
  const hasAction = Boolean(ad.action_url);

  const handlePress = () => {
    if (!ad.action_url) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openActionUrl(ad.action_url);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      className={cn('overflow-hidden', className)}
    >
      <Pressable
        onPress={hasAction ? handlePress : undefined}
        disabled={!hasAction}
        className={cn(
          'overflow-hidden rounded-2xl border border-fox-border active:opacity-90',
          hasAction && 'active:scale-[0.99]'
        )}
      >
        <Image
          source={{ uri: ad.image_url }}
          className="w-full"
          style={{ height: imageHeight }}
          resizeMode="cover"
        />

        <View className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
          <View
            className="absolute bg-fox-lime"
            style={{
              width: 80,
              height: 12,
              transform: [{ rotate: '45deg' }],
              top: 20,
              right: -20,
            }}
          />
        </View>

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.92)']}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: compact ? 72 : 100,
          }}
        />

        <View className="absolute bottom-3 left-3 right-3">
          <Text className="text-fox-lime text-[10px] font-body-semibold uppercase tracking-[0.15em]">
            {ad.sponsor_name}
          </Text>
          <Text
            className={cn(
              'text-white font-display mt-0.5',
              compact ? 'text-sm' : 'text-base'
            )}
            numberOfLines={2}
          >
            {ad.banner_text}
          </Text>
          {hasAction ? (
            <Text className="text-neutral-400 text-[10px] font-body mt-1">
              Tap to open offer
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
